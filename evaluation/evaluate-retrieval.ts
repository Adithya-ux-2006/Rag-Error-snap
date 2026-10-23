import fs from 'fs';
import path from 'path';
import { retrieveEvidence } from '@/lib/retrieval';
import { CodingErrorRecord } from '@/lib/types';

const recordsPath = path.join(__dirname, '..', 'database', 'seed.json');
const testQueriesPath = path.join(__dirname, 'test-queries.json');

async function loadSeedData(): Promise<CodingErrorRecord[]> {
  const raw = fs.readFileSync(recordsPath, 'utf-8');
  return JSON.parse(raw);
}

async function loadTestQueries() {
  const raw = fs.readFileSync(testQueriesPath, 'utf-8');
  return JSON.parse(raw);
}

async function runEvaluation(): Promise<void> {
  try {
    const records = await loadSeedData();
    const testQueries = await loadTestQueries();

    console.log(`Loaded ${records.length} seed records and ${testQueries.length} evaluation queries`);

    const results = [];

    for (const query of testQueries) {
      // Retrieve evidence
      const evidence = retrieveEvidence(
        query.query,
        query.language || 'all',
        records,
        3, // topK
        0.15 // threshold
      );

      // Determine if top-1 is correct
      const top1Correct = evidence.length > 0 && query.expected_record_ids.includes(evidence[0].record.id);

      // Determine if top-3 contains relevant record
      const top3Relevant = evidence.filter(item => query.expected_record_ids.includes(item.record.id)).length > 0;

      results.push({
        query_id: query.id,
        query: query.query,
        language: query.language,
        expected_record_ids: query.expected_record_ids,
        retrieved_count: evidence.length,
        retrieved_ids: evidence.map(item => item.record.id),
        top1_correct: top1Correct,
        top3_contains_relevant: top3Relevant,
        scores: evidence.map(item => item.score),
      });
    }

    // Calculate metrics
    const totalQueries = results.length;
    const top1CorrectCount = results.filter(r => r.top1_correct).length;
    const top3RelevantCount = results.filter(r => r.top3_contains_relevant).length;

    const top1Accuracy = totalQueries > 0 ? (top1CorrectCount / totalQueries) * 100 : 0;
    const top3Accuracy = totalQueries > 0 ? (top3RelevantCount / totalQueries) * 100 : 0;

    // Write results to CSV
    const csvHeaders = [
      'query_id',
      'query',
      'language',
      'expected_record_ids',
      'retrieved_count',
      'retrieved_ids',
      'top1_correct',
      'top3_contains_relevant',
      'scores'
    ].join(',') + '\n';

    const csvRows = results.map(r => [
      r.query_id,
      r.query,
      r.language,
      r.expected_record_ids.join(';'),
      r.retrieved_count,
      r.retrieved_ids.join(';'),
      r.top1_correct,
      r.top3_contains_relevant,
      r.scores.join(';')
    ].map(field => {
      if (typeof field === 'boolean') {
        return field.toString();
      }
      if (field == null || field == undefined) {
        return '';
      }
      // Escape quotes and wrap if contains comma
      return String(field).includes(',') || String(field).includes('"') || String(field).includes(';')
        ? `"${String(field).replace(/"/g, '""')}"`
        : String(field);
    }).join(',')) + '\n';

    const csvContent = csvHeaders + csvRows;

    // Write to file
    const outputPath = path.join(__dirname, 'results.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    // Console summary
    console.log('\n--- Retrieval Evaluation Results ---');
    console.log(`Total queries evaluated: ${totalQueries}`);
    console.log(`Top-1 accuracy: ${top1Accuracy.toFixed(2)}% (${top1CorrectCount}/${totalQueries})`);
    console.log(`Top-3 accuracy: ${top3Accuracy.toFixed(2)}% (${top3RelevantCount}/${totalQueries})`);
    console.log(`Results written to: ${outputPath}`);

    // Write a summary report
    const reportPath = path.join(__dirname, 'evaluation-report.txt');
    const reportContent = `
Evaluation Report for ErrorSnap RAG System
============================================

Generated: ${new Date().toISOString()}

Query Set: ${testQueries.length} test queries (from database/seed.json)
Seed Records: ${records.length} curated error records

Performance Metrics:
- Total queries evaluated: ${totalQueries}
- Top-1 accuracy: ${top1Accuracy.toFixed(2)}% (${top1CorrectCount}/${totalQueries})
- Top-3 accuracy: ${top3Accuracy.toFixed(2)}% (${top3RelevantCount}/${totalQueries})

Query Details:
${results.map(r => `
Query ID: ${r.query_id}
Query: "${r.query}"
Language: ${r.language || 'all'}
Expected Records: ${r.expected_record_ids.join(', ')}
Retrieved Records: ${r.retrieved_ids.join(', ') || 'None'}
Top-1 Correct: ${r.top1_correct ? '✓' : '✗'}
Top-3 Contains Relevant: ${r.top3_contains_relevant ? '✓' : '✗'}
Score: ${r.scores.join(', ')}
`).join('\n---\n')}

Retrieval Evaluation Complete.
`;

    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`Detailed report written to: ${reportPath}`);

  } catch (error) {
    console.error('Evaluation failed:', error);
    process.exit(1);
  }
}

runEvaluation();
