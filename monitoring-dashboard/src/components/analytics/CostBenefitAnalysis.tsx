/**
 * Cost Benefit Analysis Component
 * Displays ROI trends and savings
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
} from '@mui/material';
import { Refresh, AttachMoney, TrendingUp, Savings } from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiService } from '../../services/api';

interface CostBenefitAnalysisProps {
  refreshKey?: number;
}

export const CostBenefitAnalysis: React.FC<CostBenefitAnalysisProps> = ({ refreshKey = 0 }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalysis = useCallback(async () => {
    try {
      const costData = (await apiService.getCostTracking()) as {
        layers?: Record<string, { monthly_cost?: number }>;
        total_monthly_cost?: number;
      };

      const layers = costData.layers || {};
      const totalMonthlyCost = Number(costData.total_monthly_cost) || 0;
      const roiTrend: Array<{ month: string; cost: number; savings: number; roi: number }> = [];

      setAnalysis({
        totalMonthlyCost,
        totalSavings: 0,
        currentROI: 0,
        roiTrend,
        layerBreakdown: Object.keys(layers).map((layer) => ({
          layer,
          cost: layers[layer].monthly_cost || 0,
          percentage:
            totalMonthlyCost > 0
              ? ((layers[layer].monthly_cost || 0) / totalMonthlyCost) * 100
              : 0,
        })),
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching cost benefit analysis:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalysis, refreshKey]);

  if (loading && !analysis) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading cost benefit analysis...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(236, 72, 153, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        maxHeight: '600px',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ec4899 0%, #f59e0b 50%, #10b981 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AttachMoney sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Optimization Impact (ROI)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Monthly cost from the API; ROI trend only when time-series data is available
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#94a3b8',
                  fontSize: '0.7rem',
                  display: 'block',
                  mt: 0.25,
                }}
              >
                Cost figures come from the cost-tracking API only.
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={fetchAnalysis}
            size="small"
            sx={{
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              color: '#ec4899',
              '&:hover': {
                backgroundColor: 'rgba(236, 72, 153, 0.2)',
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s',
              width: 28,
              height: 28,
            }}
          >
            <Refresh sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>

        {/* Stats */}
        {analysis && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip
              icon={<AttachMoney sx={{ fontSize: 12 }} />}
              label={`$${analysis.totalMonthlyCost.toFixed(2)}/mo`}
              size="small"
              sx={{
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                color: '#ec4899',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            {analysis.roiTrend.length > 0 && (
              <>
                <Chip
                  icon={<Savings sx={{ fontSize: 12 }} />}
                  label={`$${analysis.totalSavings.toFixed(2)} saved`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: '20px',
                  }}
                />
                <Chip
                  icon={<TrendingUp sx={{ fontSize: 12 }} />}
                  label={`${analysis.currentROI.toFixed(1)}% ROI`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    color: '#6366f1',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: '20px',
                  }}
                />
              </>
            )}
          </Box>
        )}

        {/* Charts */}
        {analysis && analysis.roiTrend && analysis.roiTrend.length > 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5, display: 'block' }}>
                ROI Trend (12 Months)
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.roiTrend}>
                  <defs>
                    <linearGradient id="colorROI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="#64748b" />
                  <YAxis yAxisId="left" tick={{ fontSize: 9 }} stroke="#64748b" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} stroke="#64748b" />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
                  <Area yAxisId="left" type="monotone" dataKey="roi" stroke="#10b981" fillOpacity={1} fill="url(#colorROI)" name="ROI %" />
                  <Area yAxisId="right" type="monotone" dataKey="savings" stroke="#6366f1" fillOpacity={1} fill="url(#colorSavings)" name="Savings $" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No cost benefit data available
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

