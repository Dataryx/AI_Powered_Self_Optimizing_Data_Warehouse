/**
 * Data Explorer Page
 * Modern, enterprise-grade schema and metadata exploration
 * Design: Clean, minimal, professional - comparable to Snowflake/Databricks internal tools
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Drawer,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Search,
  Close,
  Storage,
  TableChart,
  DataObject,
  AccessTime,
  Schema,
  TrendingUp,
  CheckCircle,
  Warning,
  ArrowForward,
} from '@mui/icons-material';
import { apiService } from '../services/api';

interface TableInfo {
  name: string;
  layer: string;
  column_count: number;
  row_count?: number;
  last_updated?: string;
  schema?: string;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  nullable?: boolean;
  description?: string;
}

interface TableMetadata {
  table: string;
  layer: string;
  columns: ColumnInfo[];
  row_count: number;
  last_updated: string;
  upstream_pipelines?: string[];
  downstream_pipelines?: string[];
  data_quality_score?: number;
  schema_drift?: boolean;
}

const layerColors = {
  bronze: { bg: '#f59e0b', light: '#fef3c7', border: '#f59e0b40' },
  silver: { bg: '#6366f1', light: '#e0e7ff', border: '#6366f140' },
  gold: { bg: '#10b981', light: '#d1fae5', border: '#10b98140' },
};

const layerIcons = {
  bronze: Storage,
  silver: TableChart,
  gold: DataObject,
};

export const DataExplorerPage: React.FC = () => {
  const [selectedLayer, setSelectedLayer] = useState<'bronze' | 'silver' | 'gold'>('bronze');
  const [searchQuery, setSearchQuery] = useState('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableMetadata | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [layerCounts, setLayerCounts] = useState({ bronze: 0, silver: 0, gold: 0 });

  // Fetch tables for selected layer
  const fetchTables = useCallback(async (layer: string) => {
    setLoading(true);
    try {
      const schemasData = await apiService.getSchemas();
      const schemaMap: any = {};
      schemasData.schemas?.forEach((s: any) => {
        schemaMap[s.name] = s;
      });

      // Get tables for the selected layer
      const tablesData = await apiService.getTables(layer);
      const tablesList: TableInfo[] = (tablesData.tables || []).map((table: any) => ({
        name: table.name || table.table,
        layer,
        column_count: table.column_count || 0,
        row_count: table.row_count,
        last_updated: table.last_updated,
        schema: layer,
      }));

      setTables(tablesList);

      // Update layer counts
      setLayerCounts({
        bronze: schemaMap.bronze?.table_count || 0,
        silver: schemaMap.silver?.table_count || 0,
        gold: schemaMap.gold?.table_count || 0,
      });
    } catch (err) {
      console.error('Error fetching tables:', err);
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables(selectedLayer);
  }, [selectedLayer, fetchTables]);

  // Filter tables based on search query
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const query = searchQuery.toLowerCase();
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(query) ||
        table.layer.toLowerCase().includes(query)
    );
  }, [tables, searchQuery]);

  // Handle table card click
  const handleTableClick = async (table: TableInfo) => {
    try {
      // Fetch table stats and metadata
      const statsData = await apiService.getTableStats(table.schema || table.layer, table.name);
      
      // Fetch table data to get column information
      const tableData = await apiService.getTableData(table.schema || table.layer, table.name, 1, 0);
      
      const columns: ColumnInfo[] = (tableData.columns || []).map((col: any) => ({
        name: col.name,
        data_type: col.type || col.data_type || 'unknown',
        nullable: col.nullable !== false,
      }));

      const metadata: TableMetadata = {
        table: table.name,
        layer: table.layer,
        columns,
        row_count: statsData.row_count || table.row_count || 0,
        last_updated: statsData.last_updated || table.last_updated || 'Unknown',
        upstream_pipelines: statsData.upstream_pipelines || [],
        downstream_pipelines: statsData.downstream_pipelines || [],
        data_quality_score: statsData.data_quality_score,
        schema_drift: statsData.schema_drift || false,
      };

      setSelectedTable(metadata);
      setDrawerOpen(true);
    } catch (err) {
      console.error('Error fetching table metadata:', err);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedTable(null);
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return dateString;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#fafbfc',
        fontFamily: '"Inter", "SF Pro Display", "Roboto", sans-serif',
        p: 4,
      }}
    >
      <Box sx={{ maxWidth: '1600px', mx: 'auto' }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              color: '#0f172a',
              fontSize: '1.875rem',
              letterSpacing: '-0.02em',
              mb: 0.5,
            }}
          >
            Data Explorer
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#64748b',
              fontSize: '0.9375rem',
              fontWeight: 300,
            }}
          >
            Browse schemas and metadata across warehouse layers
          </Typography>
        </Box>

        {/* Layer Selector - Pill Style Tabs */}
        <Box sx={{ mb: 3, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {(['bronze', 'silver', 'gold'] as const).map((layer) => {
            const LayerIcon = layerIcons[layer];
            const colors = layerColors[layer];
            const isSelected = selectedLayer === layer;

            return (
              <Paper
                key={layer}
                onClick={() => setSelectedLayer(layer)}
                elevation={0}
                sx={{
                  px: 2.5,
                  py: 1,
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isSelected ? colors.bg : '#ffffff',
                  border: `1.5px solid ${isSelected ? colors.bg : '#e2e8f0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': {
                    borderColor: colors.bg,
                    boxShadow: `0 2px 8px ${colors.border}`,
                  },
                }}
              >
                <LayerIcon
                  sx={{
                    fontSize: 18,
                    color: isSelected ? '#ffffff' : colors.bg,
                  }}
                />
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: isSelected ? '#ffffff' : '#0f172a',
                    textTransform: 'capitalize',
                  }}
                >
                  {layer}
                </Typography>
                <Chip
                  label={layerCounts[layer]}
                  size="small"
                  sx={{
                    height: '20px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.light,
                    color: isSelected ? '#ffffff' : colors.bg,
                    border: 'none',
                  }}
                />
              </Paper>
            );
          })}
        </Box>

        {/* Global Search */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search tables and columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#64748b', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    sx={{ color: '#64748b' }}
                  >
                    <Close sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
                borderRadius: 2,
                '& fieldset': {
                  borderColor: '#e2e8f0',
                },
                '&:hover fieldset': {
                  borderColor: '#cbd5e1',
                },
                '&.Mui-focused fieldset': {
                  borderColor: layerColors[selectedLayer].bg,
                },
              },
            }}
          />
        </Box>

        {/* Table Cards Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: layerColors[selectedLayer].bg }} />
          </Box>
        ) : filteredTables.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 2,
            }}
          >
            <Schema sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#0f172a', mb: 1, fontWeight: 600 }}>
              No tables found
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              {searchQuery
                ? 'Try adjusting your search query'
                : 'No tables available in this layer'}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {filteredTables.map((table) => {
              const colors = layerColors[table.layer as keyof typeof layerColors];
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={table.name}>
                  <Paper
                    elevation={0}
                    onClick={() => handleTableClick(table)}
                    sx={{
                      p: 2.5,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        transform: 'translateY(-2px)',
                        borderColor: colors.bg,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: '#0f172a',
                            fontSize: '0.9375rem',
                            mb: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={table.name}
                        >
                          {table.name}
                        </Typography>
                        <Chip
                          label={table.layer}
                          size="small"
                          sx={{
                            backgroundColor: colors.light,
                            color: colors.bg,
                            fontWeight: 600,
                            fontSize: '0.6875rem',
                            height: '22px',
                            textTransform: 'capitalize',
                          }}
                        />
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1.5, borderColor: '#e2e8f0' }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Columns
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8125rem' }}>
                          {table.column_count}
                        </Typography>
                      </Box>
                      {table.row_count !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Rows
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8125rem' }}>
                            {table.row_count.toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Updated
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b', fontSize: '0.75rem' }}>
                          {formatTimeAgo(table.last_updated)}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '500px', md: '600px' },
            background: '#fafbfc',
          },
        }}
      >
        {selectedTable && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box
              sx={{
                p: 3,
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={selectedTable.layer}
                    size="small"
                    sx={{
                      backgroundColor: layerColors[selectedTable.layer as keyof typeof layerColors].light,
                      color: layerColors[selectedTable.layer as keyof typeof layerColors].bg,
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      height: '22px',
                      textTransform: 'capitalize',
                    }}
                  />
                  {selectedTable.schema_drift && (
                    <Tooltip title="Schema drift detected">
                      <Warning sx={{ fontSize: 18, color: '#f59e0b' }} />
                    </Tooltip>
                  )}
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: '#0f172a',
                    fontSize: '1.125rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {selectedTable.table}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDrawer} sx={{ color: '#64748b' }}>
                <Close />
              </IconButton>
            </Box>

            {/* Drawer Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
              {/* Table Metadata */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0f172a', mb: 2, fontSize: '0.875rem' }}>
                  Table Metadata
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      Row Count
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                      {selectedTable.row_count.toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      Columns
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                      {selectedTable.columns.length}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      Last Updated
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#64748b', fontSize: '0.8125rem' }}>
                      {formatTimeAgo(selectedTable.last_updated)}
                    </Typography>
                  </Grid>
                  {selectedTable.data_quality_score !== undefined && (
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                        Data Quality
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                          {selectedTable.data_quality_score.toFixed(1)}%
                        </Typography>
                        {selectedTable.data_quality_score >= 90 ? (
                          <CheckCircle sx={{ fontSize: 16, color: '#10b981' }} />
                        ) : (
                          <Warning sx={{ fontSize: 16, color: '#f59e0b' }} />
                        )}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {/* Columns List */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0f172a', mb: 2, fontSize: '0.875rem' }}>
                  Columns ({selectedTable.columns.length})
                </Typography>
                <List dense sx={{ p: 0 }}>
                  {selectedTable.columns.map((column, index) => (
                    <React.Fragment key={column.name}>
                      <ListItem
                        sx={{
                          px: 0,
                          py: 1,
                          '&:hover': {
                            backgroundColor: '#f8fafc',
                            borderRadius: 1,
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  fontSize: '0.8125rem',
                                }}
                              >
                                {column.name}
                              </Typography>
                              {!column.nullable && (
                                <Chip
                                  label="NOT NULL"
                                  size="small"
                                  sx={{
                                    height: '18px',
                                    fontSize: '0.625rem',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    fontWeight: 600,
                                  }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#64748b',
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {column.data_type}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < selectedTable.columns.length - 1 && (
                        <Divider sx={{ borderColor: '#e2e8f0' }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>

              {/* Pipeline Usage */}
              {(selectedTable.upstream_pipelines?.length || selectedTable.downstream_pipelines?.length) && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 3,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0f172a', mb: 2, fontSize: '0.875rem' }}>
                    Pipeline Usage
                  </Typography>
                  {selectedTable.upstream_pipelines && selectedTable.upstream_pipelines.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1, fontSize: '0.75rem' }}>
                        Upstream Pipelines
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {selectedTable.upstream_pipelines.map((pipeline) => (
                          <Chip
                            key={pipeline}
                            label={pipeline}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '0.75rem',
                              backgroundColor: '#e0e7ff',
                              color: '#6366f1',
                              fontWeight: 500,
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  {selectedTable.downstream_pipelines && selectedTable.downstream_pipelines.length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1, fontSize: '0.75rem' }}>
                        Downstream Pipelines
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {selectedTable.downstream_pipelines.map((pipeline) => (
                          <Chip
                            key={pipeline}
                            label={pipeline}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '0.75rem',
                              backgroundColor: '#d1fae5',
                              color: '#10b981',
                              fontWeight: 500,
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};
