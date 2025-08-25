"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AdminLayout from '../AdminLayout';

interface TableInfo {
  table_name: string;
  table_type: string;
  table_schema: string;
}

interface QueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export default function DatabaseManagement() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    if (!supabase) return;
    
    try {
      // Get table information from information_schema
      const { data, error } = await supabase
        .rpc('get_table_info'); // You'll need to create this RPC function
      
      if (error) {
        // Fallback to predefined tables if RPC doesn't exist
        setTables([
          { table_name: 'paraphrase_history', table_type: 'BASE TABLE', table_schema: 'public' },
          { table_name: 'profiles', table_type: 'BASE TABLE', table_schema: 'public' },
          { table_name: 'style_profiles', table_type: 'BASE TABLE', table_schema: 'public' },
        ]);
      } else {
        setTables(data || []);
      }
    } catch (err) {
      console.error('Error loading tables:', err);
      setError('Could not load table information');
    }
  };

  const executeQuery = async () => {
    if (!supabase || !sqlQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    
    const startTime = Date.now();
    
    try {
      // For safety, only allow SELECT queries in the admin panel
      if (!sqlQuery.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed for security reasons');
      }

      const { data, error } = await supabase
        .rpc('execute_sql', { query: sqlQuery });

      const executionTime = Date.now() - startTime;

      if (error) throw error;

      // Format the result
      const result: QueryResult = {
        data: data || [],
        columns: data && data.length > 0 ? Object.keys(data[0]) : [],
        rowCount: data ? data.length : 0,
        executionTime
      };

      setQueryResult(result);
    } catch (err) {
      setError((err as Error).message);
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  };

  const quickQuery = (query: string) => {
    setSqlQuery(query);
  };

  const exportData = () => {
    if (!queryResult || !queryResult.data.length) return;
    
    const csv = [
      queryResult.columns.join(','),
      ...queryResult.data.map(row => 
        queryResult.columns.map(col => JSON.stringify(row[col] || '')).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stylesync_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const commonQueries = [
    {
      name: 'All Users Count',
      query: 'SELECT COUNT(*) as user_count FROM auth.users'
    },
    {
      name: 'Recent Paraphrases',
      query: 'SELECT * FROM paraphrase_history ORDER BY created_at DESC LIMIT 10'
    },
    {
      name: 'Style Profiles Summary',
      query: 'SELECT COUNT(*) as profile_count FROM profiles'
    },
    {
      name: 'User Activity Today',
      query: `SELECT COUNT(*) as today_activity FROM paraphrase_history WHERE DATE(created_at) = CURRENT_DATE`
    }
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-white">Database Management</h2>
          <p className="text-gray-400">Execute queries and manage database operations</p>
        </div>

        {/* Database Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Tables</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tables.map((table, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedTable(table.table_name)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTable === table.table_name
                      ? 'bg-purple-600/30 border border-purple-500/50'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-white font-medium">{table.table_name}</p>
                  <p className="text-xs text-gray-400">{table.table_type}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Queries</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {commonQueries.map((queryItem, index) => (
                <button
                  key={index}
                  onClick={() => quickQuery(queryItem.query)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                >
                  <p className="text-white font-medium text-sm">{queryItem.name}</p>
                  <p className="text-xs text-gray-400 mt-1 truncate">{queryItem.query}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SQL Query Editor */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">SQL Query Editor</h3>
            <div className="flex space-x-2">
              <button
                onClick={executeQuery}
                disabled={loading || !sqlQuery.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>
              <button
                onClick={() => setSqlQuery('')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="Enter your SQL query here... (SELECT queries only for security)"
            className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg p-4 text-white font-mono text-sm resize-none focus:border-purple-500 focus:outline-none"
          />
          
          {selectedTable && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => quickQuery(`SELECT * FROM ${selectedTable} LIMIT 10`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Show 10 rows
              </button>
              <button
                onClick={() => quickQuery(`SELECT COUNT(*) FROM ${selectedTable}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Count rows
              </button>
              <button
                onClick={() => quickQuery(`SELECT * FROM ${selectedTable} ORDER BY created_at DESC LIMIT 5`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Recent entries
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
            <h4 className="text-red-400 font-semibold mb-2">Query Error</h4>
            <p className="text-red-300 font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Query Results */}
        {queryResult && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Query Results</h3>
                <p className="text-sm text-gray-400">
                  {queryResult.rowCount} rows returned in {queryResult.executionTime}ms
                </p>
              </div>
              <button
                onClick={exportData}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Export CSV
              </button>
            </div>
            
            {queryResult.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {queryResult.columns.map((column) => (
                        <th key={column} className="text-left p-3 text-gray-300 font-medium">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {queryResult.data.slice(0, 50).map((row, index) => (
                      <tr key={index} className="hover:bg-white/5">
                        {queryResult.columns.map((column) => (
                          <td key={column} className="p-3 text-gray-200 max-w-xs truncate">
                            {typeof row[column] === 'object' 
                              ? JSON.stringify(row[column]) 
                              : String(row[column] || '')
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {queryResult.data.length > 50 && (
                  <p className="text-center text-gray-400 mt-4">
                    Showing first 50 rows of {queryResult.rowCount} results
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">No data returned</p>
            )}
          </div>
        )}

        {/* Database Stats */}
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
          <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Important Notes</h4>
          <ul className="text-yellow-300 text-sm space-y-1">
            <li>• Only SELECT queries are allowed for security reasons</li>
            <li>• Always backup your database before making changes</li>
            <li>• Use the Supabase dashboard for schema modifications</li>
            <li>• Results are limited to 50 rows for performance</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
