import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

interface IntelligentInsightsProps { data?: any; loading?: boolean }

function buildInsights(data: any): Array<{ text: string }> {
  const insights: Array<{ text: string }> = [];
  if (!data) return insights;

  const freshness = data.freshness;
  const dq = data.dataQuality;
  const errors = Array.isArray(data.errors) ? data.errors : [];
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  if (freshness) {
    const slaMet = freshness.sla_met ?? 0;
    const slaTotal = freshness.sla_total ?? 3;
    const onTime = freshness.on_time ?? 0;
    const atRisk = freshness.at_risk ?? 0;
    const totalDs = freshness.total_datasets ?? 0;
    if (slaTotal > 0) insights.push({ text: `${slaMet}/${slaTotal} layers meet freshness SLA.` });
    if (totalDs > 0) insights.push({ text: `Freshness: ${onTime} on time, ${atRisk} at risk across ${totalDs} datasets.` });
  }

  if (dq?.layers?.length) {
    const poor = dq.layers.filter((l: any) => (l.hasIssue || Number(l.score) < 80));
    if (poor.length === 0) insights.push({ text: 'All medallion layers have good data quality (≥80%).' });
    else insights.push({ text: `${poor.length} layer(s) need attention: quality below 80% or failing rules.` });
  }

  if (errors.length > 0) insights.push({ text: `${errors.length} failed ETL job(s) in the last 7 days — review Errors & Retries.` });
  else if (jobs.length > 0) insights.push({ text: 'No failed ETL jobs recently. Pipelines are healthy.' });

  if (insights.length === 0 && (data.freshness || data.dataQuality)) insights.push({ text: 'Data quality and freshness metrics are available.' });
  return insights;
}

export default function IntelligentInsights({ data, loading }: IntelligentInsightsProps) {
  const insights = buildInsights(data);
  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3">
        <h3 className="font-body text-base font-bold text-white">Intelligent Insights</h3>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="px-5 pb-8 flex flex-col items-center justify-center py-16"
      >
        {/* Pulsing rings */}
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border border-[#a78bfa20] animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full border border-[#a78bfa15]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#a78bfa10] border border-[#a78bfa25] flex items-center justify-center">
              <Lightbulb size={18} className="text-[#a78bfa]" />
            </div>
          </div>
        </div>
        {loading && insights.length === 0 && <span className="font-body text-sm text-[#5a6a8a]">Loading Insights…</span>}
        {!loading && insights.length > 0 && (
          <ul className="list-none space-y-2 text-left w-full max-w-md">
            {insights.map((insight, i) => (
              <li key={i} className="font-body text-sm text-[#c0cde0] flex items-start gap-2">
                <span className="text-[#a78bfa] mt-0.5">•</span>
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && insights.length === 0 && <span className="font-body text-sm text-[#5a6a8a]">No insights yet. Run ETL and ensure API is connected.</span>}
        {loading && insights.length === 0 && (
          <div className="flex gap-1 mt-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
