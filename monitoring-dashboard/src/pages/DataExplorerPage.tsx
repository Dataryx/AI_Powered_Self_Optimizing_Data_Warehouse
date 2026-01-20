/**
 * Data Explorer Page
 * Browse and explore data warehouse tables
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import { apiService } from '../services/api';
import { Storage, TableChart, DataObject } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const DataExplorerPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<any>({});
  const [selectedSchema, setSelectedSchema] = useState<string>('bronze');
  const [tables, setTables] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    fetchSchemas();
  }, []);

  useEffect(() => {
    if (selectedSchema) {
      fetchTables(selectedSchema);
    }
  }, [selectedSchema]);

  const fetchSchemas = async () => {
    try {
      const data = await apiService.getSchemas();
      const schemaMap: any = {};
      data.schemas.forEach((s: any) => {
        schemaMap[s.name] = s;
      });
      setSchemas(schemaMap);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async (schema: string) => {
    try {
      const data = await apiService.getTables(schema);
      setTables(data.tables || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTableData = async (schema: string, table: string) => {
    try {
      setLoading(true);
      const data = await apiService.getTableData(schema, table, 50);
      setTableData(data);
      setSelectedTable(table);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    const schemaNames = ['bronze', 'silver', 'gold'];
    setSelectedSchema(schemaNames[newValue]);
    setTableData(null);
    setSelectedTable(null);
  };

  if (loading && !tableData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Data Explorer
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab
            icon={<Storage />}
            iconPosition="start"
            label={`Bronze (${schemas.bronze?.table_count || 0} tables)`}
          />
          <Tab
            icon={<TableChart />}
            iconPosition="start"
            label={`Silver (${schemas.silver?.table_count || 0} tables)`}
          />
          <Tab
            icon={<DataObject />}
            iconPosition="start"
            label={`Gold (${schemas.gold?.table_count || 0} tables)`}
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <SchemaView
            schema="bronze"
            tables={tabValue === 0 ? tables : []}
            onTableClick={(table) => fetchTableData('bronze', table)}
            selectedTable={selectedTable}
          />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <SchemaView
            schema="silver"
            tables={tabValue === 1 ? tables : []}
            onTableClick={(table) => fetchTableData('silver', table)}
            selectedTable={selectedTable}
          />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <SchemaView
            schema="gold"
            tables={tabValue === 2 ? tables : []}
            onTableClick={(table) => fetchTableData('gold', table)}
            selectedTable={selectedTable}
          />
        </TabPanel>
      </Paper>

      {tableData && (
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {selectedSchema}.{selectedTable} ({tableData.total_count.toLocaleString()} rows)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {tableData.columns.map((col: any) => (
                      <TableCell key={col.name} sx={{ fontWeight: 'bold' }}>
                        {col.name}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.data.slice(0, 20).map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      {tableData.columns.map((col: any) => (
                        <TableCell key={col.name}>
                          {row[col.name] !== null && row[col.name] !== undefined
                            ? String(row[col.name]).substring(0, 50)
                            : 'NULL'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

interface SchemaViewProps {
  schema: string;
  tables: any[];
  onTableClick: (table: string) => void;
  selectedTable: string | null;
}

const SchemaView: React.FC<SchemaViewProps> = ({ schema, tables, onTableClick, selectedTable }) => {
  const handleTableClick = (tableName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTableClick(tableName);
  };

  return (
    <Grid container spacing={2}>
      {tables.map((table) => (
        <Grid item xs={12} sm={6} md={4} key={table.name}>
          <Paper
            sx={{
              p: 2,
              cursor: 'pointer',
              border: selectedTable === table.name ? '2px solid #1976d2' : '1px solid #e0e0e0',
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.2s',
            }}
            onClick={(e) => handleTableClick(table.name, e)}
          >
            <Typography variant="h6" gutterBottom>
              {table.name}
            </Typography>
            <Chip label={`${table.column_count} columns`} size="small" />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};



