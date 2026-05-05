/** Payload merged server-side with DB row (when numeric id) for optimization_apply_events. */
export function recommendationApplySnapshot(rec: Record<string, unknown>) {
  return {
    type: rec.type,
    table: rec.table ?? rec.table_name,
    columns: rec.columns,
    sql_statement: rec.sql_statement,
    reason: rec.reason,
    explanation: rec.explanation,
    priority: rec.priority,
    query_count: rec.query_count,
    avg_execution_time_ms: rec.avg_execution_time_ms,
    estimated_improvement: rec.estimated_improvement,
    partition_column: rec.partition_column,
  };
}
