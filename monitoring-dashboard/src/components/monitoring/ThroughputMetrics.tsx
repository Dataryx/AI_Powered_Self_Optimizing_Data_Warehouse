/**
 * Throughput Metrics – redesigned:
 * - Clear KPI row (overall throughput, fastest table, coverage)
 * - Trend sparkline (client-side over last polls)
 * - Layer mix donut
 * - Top tables bar chart + searchable details
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Button,
  IconButton,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
  InputAdornment,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  Refresh,
  Speed,
  Timeline,
  Layers,
  Search,
  TableChart,
  InfoOutlined,
  PlayArrow,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

interface ThroughputRow {
  table: string;
  layer: string;
  records_per_second: number;
  total_records: number;
  total_operations: number;
  duration_seconds?: number;
}

interface ThroughputMetricsProps {
  refreshKey?: number;
}

type HistoryPoint = { ts: number; value: number };

const formatTimeAgo = (date: Date | null): string => {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const fmt = {
  compact(n: number, maxFrac = 1) {
    try {
      return new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: maxFrac,
      }).format(n);
    } catch {
      return n.toFixed(maxFrac);
    }
  },
  num(n: number) {
    return new Intl.NumberFormat().format(n);
  },
  dur(seconds?: number) {
    const s = Math.max(0, Math.round(seconds || 0));
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    return `${h}h`;
  },
};

const shortTable = (t: string) => t.split('.').pop() || t;

export const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({ refreshKey = 0 }) => {
  const colors = useThemeColors();

  const layerStyles: Record<string, { bg: string; text: string; border: string; accent: string }> = {
    bronze: colors.layerBronze,
    silver: colors.layerSilver,
    gold: colors.layerGold,
  };

  const [rows, setRows] = useState<ThroughputRow[]>([]);
  const [overall, setOverall] = useState(0);
  const [overallHistory, setOverallHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [query, setQuery] = useState('');

  const [etlJobDefs, setEtlJobDefs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [selectedJobName, setSelectedJobName] = useState<string>('Complete ETL Pipeline');
  const [runningETL, setRunningETL] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const fetchThroughput = useCallback(async () => {
    try {
      setError(null);
      const data = (await apiService.getThroughputMetrics()) as any;
      const nextRows = (data?.throughput || []) as ThroughputRow[];
      const nextOverall = Number(data?.overall_throughput || 0);
      setRows(nextRows);
      setOverall(nextOverall);
      setOverallHistory((prev) => {
        const next = [...prev, { ts: Date.now(), value: nextOverall }];
        return next.slice(-40); // ~10 minutes at 15s refresh
      });
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching throughput metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch throughput metrics');
      setLoading(false);
    }
  }, []);

  const fetchJobDefinitions = useCallback(async () => {
    try {
      setJobsError(null);
      setJobsLoading(true);
      setRunError(null);

      const data = (await apiService.getETLJobDefinitions()) as any;
      const nextJobs = (data?.jobs || []) as any[];
      setEtlJobDefs(nextJobs);

      const nextSelected =
        nextJobs.find((j) => j?.job_name === 'Complete ETL Pipeline')?.job_name ||
        nextJobs[0]?.job_name ||
        'Complete ETL Pipeline';
      setSelectedJobName(nextSelected);
    } catch (err) {
      console.error('Error fetching ETL job definitions:', err);
      setJobsError(err instanceof Error ? err.message : 'Failed to fetch ETL job definitions');
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThroughput();
    const interval = setInterval(fetchThroughput, 15000);
    return () => clearInterval(interval);
  }, [refreshKey, fetchThroughput]);

  useEffect(() => {
    fetchJobDefinitions();
  }, [refreshKey, fetchJobDefinitions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.table.toLowerCase().includes(q) || shortTable(r.table).toLowerCase().includes(q));
  }, [rows, query]);

  const sorted = useMemo(() => {
    return filtered.slice().sort((a, b) => (b.records_per_second || 0) - (a.records_per_second || 0));
  }, [filtered]);

  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];
  const sumTop = sorted.reduce((acc, r) => acc + (r.records_per_second || 0), 0);

  const layerMix = useMemo(() => {
    const byLayer = new Map<string, number>();
    for (const r of sorted) {
      const layer = (r.layer || 'unknown').toLowerCase();
      byLayer.set(layer, (byLayer.get(layer) || 0) + (r.records_per_second || 0));
    }
    return Array.from(byLayer.entries())
      .map(([layer, value]) => ({ layer, value }))
      .sort((a, b) => b.value - a.value);
  }, [sorted]);

  const trendDelta = useMemo(() => {
    const n = overallHistory.length;
    if (n < 2) return null;
    const prev = overallHistory[n - 2]?.value ?? 0;
    const cur = overallHistory[n - 1]?.value ?? 0;
    const diff = cur - prev;
    const pct = prev === 0 ? null : (diff / prev) * 100;
    return { diff, pct };
  }, [overallHistory]);

  const chartTables = sorted.slice(0, 8).map((r) => ({
    ...r,
    short: shortTable(r.table),
  }));

  const isEmpty = !loading && rows.length === 0;

  if (loading && rows.length === 0) {
    return (
      <Card sx={{ border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Run ETL to populate throughput metrics.
            </Typography>

            {jobsLoading ? (
              <LinearProgress sx={{ width: '100%', height: 6, borderRadius: 3 }} />
            ) : (
              <>
                <TextField
                  select
                  label="ETL Job"
                  size="small"
                  value={selectedJobName}
                  onChange={(e) => setSelectedJobName(String(e.target.value))}
                  sx={{ minWidth: 260 }}
                  disabled={runningETL || jobsError != null}
                >
                  {(etlJobDefs?.length ? etlJobDefs : [{ job_name: 'Complete ETL Pipeline', job_type: 'pipeline' }]).map((job) => (
                    <MenuItem key={job?.job_id || job?.job_name} value={job?.job_name}>
                      {job?.job_name}
                    </MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="contained"
                  disabled={runningETL || !selectedJobName}
                  onClick={async () => {
                    setRunError(null);
                    setRunningETL(true);
                    try {
                      await apiService.runETLJob(selectedJobName);
                      // Throughput updates after ETL finishes; polling will refresh automatically.
                      fetchThroughput();
                    } catch (err) {
                      setRunError(err instanceof Error ? err.message : 'Failed to start ETL job');
                    } finally {
                      setRunningETL(false);
                    }
                  }}
                  startIcon={<PlayArrow />}
                  sx={{ width: 220 }}
                >
                  {runningETL ? 'Running…' : 'Run ETL'}
                </Button>

                {jobsError && (
                  <Typography variant="caption" sx={{ color: colors.error, display: 'block' }}>
                    {jobsError}
                  </Typography>
                )}
                {runError && (
                  <Typography variant="caption" sx={{ color: colors.error, display: 'block' }}>
                    {runError}
                  </Typography>
                )}
              </>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error && rows.length === 0) {
    return (
      <Card sx={{ border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: colors.error, mb: 1 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchThroughput} size="small" aria-label="Retry">
            <Refresh fontSize="small" />
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card sx={{ border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Speed sx={{ color: colors.textMuted, fontSize: 40, mb: 1 }} />
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            No throughput yet. Run ETL jobs to populate run history.
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disabled={runningETL || !selectedJobName}
              onClick={async () => {
                setRunError(null);
                setRunningETL(true);
                try {
                  await apiService.runETLJob(selectedJobName);
                  fetchThroughput();
                } catch (err) {
                  setRunError(err instanceof Error ? err.message : 'Failed to start ETL job');
                } finally {
                  setRunningETL(false);
                }
              }}
              startIcon={<PlayArrow />}
            >
              {runningETL ? 'Running…' : 'Run ETL'}
            </Button>
            {runError && (
              <Typography variant="caption" sx={{ color: colors.error, display: 'block' }}>
                {runError}
              </Typography>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: colors.textMuted, display: 'block', mt: 0.5 }}>
            This view uses the last 24h of completed job runs.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        border: `1px solid ${colors.border}`,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: colors.paper,
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Box
          sx={{
            p: 2.5,
            background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 70%)`,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 280 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Speed sx={{ color: colors.primary }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: colors.text }}>
                  Throughput
                </Typography>
                <MuiTooltip title="Computed from completed ETL runs in the last 24 hours.">
                  <InfoOutlined sx={{ fontSize: 16, color: colors.textMuted }} />
                </MuiTooltip>
              </Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mt: 0.25 }}>
                Records processed per second (higher is faster)
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                Updated {formatTimeAgo(lastFetch)}
              </Typography>
              <IconButton size="small" onClick={fetchThroughput} aria-label="Refresh" sx={{ color: colors.primary }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* KPI row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr 1fr' },
              gap: 1.5,
              mt: 2,
            }}
          >
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${colors.border}`,
                background: `linear-gradient(135deg, ${colors.primary}12 0%, ${colors.paper} 70%)`,
              }}
            >
              <Typography variant="overline" sx={{ color: colors.primary, fontWeight: 700, letterSpacing: 0.5 }}>
                Overall throughput
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.25 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: colors.primaryDark }}>
                  {overall.toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  rec/s
                </Typography>
                {trendDelta && (
                  <Chip
                    size="small"
                    label={
                      trendDelta.pct == null
                        ? `${trendDelta.diff >= 0 ? '+' : ''}${trendDelta.diff.toFixed(2)}`
                        : `${trendDelta.pct >= 0 ? '+' : ''}${trendDelta.pct.toFixed(1)}%`
                    }
                    sx={{
                      ml: 0.5,
                      height: 22,
                      fontWeight: 700,
                      bgcolor: trendDelta.diff >= 0 ? `${colors.success}18` : `${colors.error}18`,
                      color: trendDelta.diff >= 0 ? colors.success : colors.error,
                      border: `1px solid ${trendDelta.diff >= 0 ? `${colors.success}30` : `${colors.error}30`}`,
                    }}
                  />
                )}
              </Box>
              <Box sx={{ height: 52, mt: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overallHistory.map((p) => ({ value: p.value }))}>
                    <Line type="monotone" dataKey="value" stroke={colors.primary} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${colors.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="overline" sx={{ color: colors.textMuted, fontWeight: 700 }}>
                  Fastest table
                </Typography>
                <Timeline sx={{ fontSize: 18, color: colors.textMuted }} />
              </Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: colors.text, mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={fastest?.table}
              >
                {fastest ? shortTable(fastest.table) : '—'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Chip
                  size="small"
                  label={(fastest?.layer || '—').toLowerCase()}
                  sx={{
                    height: 20,
                    fontSize: '0.72rem',
                    textTransform: 'capitalize',
                    bgcolor: (layerStyles[(fastest?.layer || '').toLowerCase()] || { bg: colors.accentLight }).bg,
                    color: (layerStyles[(fastest?.layer || '').toLowerCase()] || { text: colors.textMuted }).text,
                    fontWeight: 700,
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 800, color: colors.text }}>
                  {fastest ? fastest.records_per_second.toFixed(2) : '0.00'}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  rec/s
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: colors.textMuted, display: 'block', mt: 0.75 }}>
                Slowest: {slowest ? `${shortTable(slowest.table)} (${slowest.records_per_second.toFixed(2)} rec/s)` : '—'}
              </Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${colors.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="overline" sx={{ color: colors.textMuted, fontWeight: 700 }}>
                  Coverage (top tables)
                </Typography>
                <Layers sx={{ fontSize: 18, color: colors.textMuted }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: colors.text, mt: 0.5 }}>
                {sorted.length}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                tables shown • {fmt.compact(sumTop, 2)} rec/s in this view
              </Typography>
              <Divider sx={{ my: 1.25, borderColor: colors.borderLight }} />
              <Box sx={{ height: 84 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={layerMix}
                      dataKey="value"
                      nameKey="layer"
                      innerRadius={26}
                      outerRadius={38}
                      paddingAngle={2}
                    >
                      {layerMix.map((p) => {
                        const s = layerStyles[p.layer] || null;
                        const fill = s?.accent || colors.chart[0];
                        return <Cell key={p.layer} fill={fill} />;
                      })}
                    </Pie>
                    <RechartsTooltip
                      formatter={(v: any, _n: any, props: any) => {
                        const name = props?.payload?.layer || 'layer';
                        return [`${Number(v).toFixed(2)} rec/s`, name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {layerMix.slice(0, 3).map((p) => {
                  const style = layerStyles[p.layer] || { bg: colors.accentLight, text: colors.textMuted, border: colors.border, accent: colors.accent };
                  return (
                    <Chip
                      key={p.layer}
                      size="small"
                      label={`${p.layer}: ${p.value.toFixed(2)} rec/s`}
                      sx={{
                        height: 22,
                        bgcolor: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        fontWeight: 700,
                        textTransform: 'capitalize',
                      }}
                      variant="outlined"
                    />
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Details */}
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableChart sx={{ color: colors.textSecondary }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.textMuted }}>
                Top tables (this API returns up to 10)
              </Typography>
            </Box>
            <TextField
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by table name…"
              sx={{ minWidth: { xs: '100%', sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ height: 220, mt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTables} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderLight} />
                <XAxis type="number" tick={{ fill: colors.textMuted, fontSize: 12 }} />
                <YAxis type="category" dataKey="short" width={110} tick={{ fill: colors.textMuted, fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{ background: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                  formatter={(v: any, _n: any, props: any) => {
                    const p = props?.payload as ThroughputRow | undefined;
                    const layer = (p?.layer || '').toLowerCase();
                    const t = p?.table || '';
                    const dur = fmt.dur((p as any)?.duration_seconds);
                    return [`${Number(v).toFixed(2)} rec/s • ${dur}`, `${layer}.${shortTable(t)}`];
                  }}
                />
                <Bar dataKey="records_per_second" radius={[8, 8, 8, 8]}>
                  {chartTables.map((r) => {
                    const style = layerStyles[(r.layer || '').toLowerCase()] || { accent: colors.primary } as any;
                    return <Cell key={r.table} fill={style.accent || colors.primary} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Divider sx={{ my: 2, borderColor: colors.borderLight }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sorted.map((r) => {
              const layer = (r.layer || 'unknown').toLowerCase();
              const style = layerStyles[layer] || { bg: colors.accentLight, text: colors.textMuted, border: colors.border, accent: colors.accent };
              return (
                <Box
                  key={r.table}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr auto auto' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1,
                    py: 1,
                    px: 1.25,
                    borderRadius: 2,
                    border: `1px solid ${colors.borderLight}`,
                    '&:hover': { backgroundColor: colors.background },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.table}
                    >
                      {shortTable(r.table)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                      {r.table}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                    <Chip
                      size="small"
                      label={layer}
                      sx={{
                        height: 22,
                        fontSize: '0.72rem',
                        textTransform: 'capitalize',
                        bgcolor: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        fontWeight: 800,
                      }}
                      variant="outlined"
                    />
                    <Typography variant="body2" sx={{ fontWeight: 900, color: colors.text }}>
                      {Number(r.records_per_second || 0).toFixed(2)} rec/s
                    </Typography>
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{ color: colors.textMuted, textAlign: { xs: 'left', sm: 'right' } }}
                    title="records processed • duration"
                  >
                    {fmt.compact(Number(r.total_records || 0), 1)} rec • {fmt.dur(r.duration_seconds)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
