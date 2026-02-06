import type { FeederReportRow, SavedReport } from '../types';
import { getWeekLabel } from '../utils/excelUtils';

interface ComparisonViewProps {
  currentReport: FeederReportRow[];
  currentDateRange: { start: string; end: string };
  previousReport: SavedReport | null;
  onExport: (data: FeederReportRow[], filename: string) => void;
}

interface ComparisonRow {
  feederName: string;
  current: FeederReportRow | null;
  previous: FeederReportRow | null;
  diff: {
    mappedDTWeek: number;
    mappedDTTotal: number;
    htPolesWeek: number;
    htPolesTotal: number;
    ltPolesWeek: number;
    ltPolesTotal: number;
    consumerPointsWeek: number;
    consumerPointsTotal: number;
    issueLogCount: number;
  };
}

export function ComparisonView({ 
  currentReport, 
  currentDateRange,
  previousReport,
  onExport 
}: ComparisonViewProps) {
  // Build comparison data
  const buildComparisonData = (): ComparisonRow[] => {
    const allFeeders = new Set<string>();
    
    currentReport.forEach(r => allFeeders.add(r.feederName));
    previousReport?.data.forEach(r => allFeeders.add(r.feederName));
    
    const currentMap = new Map(currentReport.map(r => [r.feederName, r]));
    const previousMap = new Map(previousReport?.data.map(r => [r.feederName, r]) || []);
    
    return Array.from(allFeeders).sort().map(feederName => {
      const current = currentMap.get(feederName) || null;
      const previous = previousMap.get(feederName) || null;
      
      const diff = {
        mappedDTWeek: (current?.mappedDTWeek || 0) - (previous?.mappedDTWeek || 0),
        mappedDTTotal: (current?.mappedDTTotal || 0) - (previous?.mappedDTTotal || 0),
        htPolesWeek: (current?.htPolesWeek || 0) - (previous?.htPolesWeek || 0),
        htPolesTotal: (current?.htPolesTotal || 0) - (previous?.htPolesTotal || 0),
        ltPolesWeek: (current?.ltPolesWeek || 0) - (previous?.ltPolesWeek || 0),
        ltPolesTotal: (current?.ltPolesTotal || 0) - (previous?.ltPolesTotal || 0),
        consumerPointsWeek: (current?.consumerPointsWeek || 0) - (previous?.consumerPointsWeek || 0),
        consumerPointsTotal: (current?.consumerPointsTotal || 0) - (previous?.consumerPointsTotal || 0),
        issueLogCount: (current?.issueLogCount || 0) - (previous?.issueLogCount || 0),
      };
      
      return { feederName, current, previous, diff };
    });
  };

  const comparisonData = buildComparisonData();

  // Calculate totals
  const totals = {
    current: {
      mappedDTWeek: currentReport.reduce((sum, r) => sum + r.mappedDTWeek, 0),
      mappedDTTotal: currentReport.reduce((sum, r) => sum + r.mappedDTTotal, 0),
      htPolesWeek: currentReport.reduce((sum, r) => sum + r.htPolesWeek, 0),
      htPolesTotal: currentReport.reduce((sum, r) => sum + r.htPolesTotal, 0),
      ltPolesWeek: currentReport.reduce((sum, r) => sum + r.ltPolesWeek, 0),
      ltPolesTotal: currentReport.reduce((sum, r) => sum + r.ltPolesTotal, 0),
      consumerPointsWeek: currentReport.reduce((sum, r) => sum + r.consumerPointsWeek, 0),
      consumerPointsTotal: currentReport.reduce((sum, r) => sum + r.consumerPointsTotal, 0),
      issueLogCount: currentReport.reduce((sum, r) => sum + r.issueLogCount, 0),
    },
    previous: {
      mappedDTWeek: (previousReport?.data || []).reduce((sum, r) => sum + r.mappedDTWeek, 0),
      mappedDTTotal: (previousReport?.data || []).reduce((sum, r) => sum + r.mappedDTTotal, 0),
      htPolesWeek: (previousReport?.data || []).reduce((sum, r) => sum + r.htPolesWeek, 0),
      htPolesTotal: (previousReport?.data || []).reduce((sum, r) => sum + r.htPolesTotal, 0),
      ltPolesWeek: (previousReport?.data || []).reduce((sum, r) => sum + r.ltPolesWeek, 0),
      ltPolesTotal: (previousReport?.data || []).reduce((sum, r) => sum + r.ltPolesTotal, 0),
      consumerPointsWeek: (previousReport?.data || []).reduce((sum, r) => sum + r.consumerPointsWeek, 0),
      consumerPointsTotal: (previousReport?.data || []).reduce((sum, r) => sum + r.consumerPointsTotal, 0),
      issueLogCount: (previousReport?.data || []).reduce((sum, r) => sum + r.issueLogCount, 0),
    },
  };

  const formatDiff = (value: number) => {
    if (value === 0) return '-';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value}`;
  };

  const getDiffClass = (value: number) => {
    if (value > 0) return 'text-green-600 bg-green-50';
    if (value < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-400';
  };

  if (currentReport.length === 0 && !previousReport) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data to Compare</h3>
        <p className="text-gray-500">
          Generate a current report and save a previous week report to see the comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="p-1.5 bg-blue-100 rounded-lg">📊</span>
            <div>
              <h3 className="font-semibold text-gray-800">Current Week</h3>
              <p className="text-sm text-gray-500">
                {currentDateRange.start ? getWeekLabel(currentDateRange.start, currentDateRange.end) : 'Not generated'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-blue-50 p-2 rounded">
              <span className="text-gray-600">Mapped DT:</span>
              <span className="float-right font-semibold">{totals.current.mappedDTWeek} / {totals.current.mappedDTTotal}</span>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <span className="text-gray-600">HT Poles:</span>
              <span className="float-right font-semibold">{totals.current.htPolesWeek} / {totals.current.htPolesTotal}</span>
            </div>
            <div className="bg-orange-50 p-2 rounded">
              <span className="text-gray-600">LT Poles:</span>
              <span className="float-right font-semibold">{totals.current.ltPolesWeek} / {totals.current.ltPolesTotal}</span>
            </div>
            <div className="bg-pink-50 p-2 rounded">
              <span className="text-gray-600">Consumer Pts:</span>
              <span className="float-right font-semibold">{totals.current.consumerPointsWeek} / {totals.current.consumerPointsTotal}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="p-1.5 bg-purple-100 rounded-lg">📋</span>
            <div>
              <h3 className="font-semibold text-gray-800">Previous Week</h3>
              <p className="text-sm text-gray-500">
                {previousReport?.weekLabel || 'Not saved'}
              </p>
            </div>
          </div>
          {previousReport ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 p-2 rounded">
                <span className="text-gray-600">Mapped DT:</span>
                <span className="float-right font-semibold">{totals.previous.mappedDTWeek} / {totals.previous.mappedDTTotal}</span>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <span className="text-gray-600">HT Poles:</span>
                <span className="float-right font-semibold">{totals.previous.htPolesWeek} / {totals.previous.htPolesTotal}</span>
              </div>
              <div className="bg-orange-50 p-2 rounded">
                <span className="text-gray-600">LT Poles:</span>
                <span className="float-right font-semibold">{totals.previous.ltPolesWeek} / {totals.previous.ltPolesTotal}</span>
              </div>
              <div className="bg-pink-50 p-2 rounded">
                <span className="text-gray-600">Consumer Pts:</span>
                <span className="float-right font-semibold">{totals.previous.consumerPointsWeek} / {totals.previous.consumerPointsTotal}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No previous week data saved</p>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Week-over-Week Comparison</h3>
            <p className="text-sm text-gray-500 mt-1">
              {comparisonData.length} feeders • Green = increase, Red = decrease
            </p>
          </div>
          {currentReport.length > 0 && (
            <button
              onClick={() => onExport(currentReport, `Comparison_Report_${currentDateRange.start}_to_${currentDateRange.end}.xlsx`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Current
            </button>
          )}
        </div>
        
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-700 sticky left-0 bg-gray-100 min-w-[200px]" rowSpan={2}>
                  Feeder Name
                </th>
                <th className="text-center px-3 py-1.5 font-semibold text-blue-700 bg-blue-50" colSpan={3}>Mapped DT</th>
                <th className="text-center px-3 py-1.5 font-semibold text-green-700 bg-green-50" colSpan={3}>HT Poles</th>
                <th className="text-center px-3 py-1.5 font-semibold text-orange-700 bg-orange-50" colSpan={3}>LT Poles</th>
                <th className="text-center px-3 py-1.5 font-semibold text-pink-700 bg-pink-50" colSpan={3}>Consumer Pts</th>
                <th className="text-center px-3 py-1.5 font-semibold text-red-700 bg-red-50" colSpan={3}>Issue Log</th>
              </tr>
              <tr className="border-b border-gray-200">
                {/* Mapped DT */}
                <th className="text-center px-2 py-1.5 text-gray-600 bg-blue-50/50">Prev</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-blue-50/50">Curr</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-blue-50/50">Δ</th>
                {/* HT Poles */}
                <th className="text-center px-2 py-1.5 text-gray-600 bg-green-50/50">Prev</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-green-50/50">Curr</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-green-50/50">Δ</th>
                {/* LT Poles */}
                <th className="text-center px-2 py-1.5 text-gray-600 bg-orange-50/50">Prev</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-orange-50/50">Curr</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-orange-50/50">Δ</th>
                {/* Consumer Pts */}
                <th className="text-center px-2 py-1.5 text-gray-600 bg-pink-50/50">Prev</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-pink-50/50">Curr</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-pink-50/50">Δ</th>
                {/* Issue Log */}
                <th className="text-center px-2 py-1.5 text-gray-600 bg-red-50/50">Prev</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-red-50/50">Curr</th>
                <th className="text-center px-2 py-1.5 text-gray-600 bg-red-50/50">Δ</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, idx) => (
                <tr key={row.feederName} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-inherit">
                    <span className="truncate block max-w-[180px]" title={row.feederName}>
                      {row.feederName}
                    </span>
                    {!row.current && <span className="text-xs text-red-500">(not in current)</span>}
                    {!row.previous && <span className="text-xs text-blue-500">(new)</span>}
                  </td>
                  
                  {/* Mapped DT */}
                  <td className="text-center px-2 py-2 bg-blue-50/30">{row.previous?.mappedDTWeek || 0}</td>
                  <td className="text-center px-2 py-2 bg-blue-50/30 font-semibold">{row.current?.mappedDTWeek || 0}</td>
                  <td className={`text-center px-2 py-2 font-semibold ${getDiffClass(row.diff.mappedDTWeek)}`}>
                    {formatDiff(row.diff.mappedDTWeek)}
                  </td>
                  
                  {/* HT Poles */}
                  <td className="text-center px-2 py-2 bg-green-50/30">{row.previous?.htPolesWeek || 0}</td>
                  <td className="text-center px-2 py-2 bg-green-50/30 font-semibold">{row.current?.htPolesWeek || 0}</td>
                  <td className={`text-center px-2 py-2 font-semibold ${getDiffClass(row.diff.htPolesWeek)}`}>
                    {formatDiff(row.diff.htPolesWeek)}
                  </td>
                  
                  {/* LT Poles */}
                  <td className="text-center px-2 py-2 bg-orange-50/30">{row.previous?.ltPolesWeek || 0}</td>
                  <td className="text-center px-2 py-2 bg-orange-50/30 font-semibold">{row.current?.ltPolesWeek || 0}</td>
                  <td className={`text-center px-2 py-2 font-semibold ${getDiffClass(row.diff.ltPolesWeek)}`}>
                    {formatDiff(row.diff.ltPolesWeek)}
                  </td>
                  
                  {/* Consumer Pts */}
                  <td className="text-center px-2 py-2 bg-pink-50/30">{row.previous?.consumerPointsWeek || 0}</td>
                  <td className="text-center px-2 py-2 bg-pink-50/30 font-semibold">{row.current?.consumerPointsWeek || 0}</td>
                  <td className={`text-center px-2 py-2 font-semibold ${getDiffClass(row.diff.consumerPointsWeek)}`}>
                    {formatDiff(row.diff.consumerPointsWeek)}
                  </td>
                  
                  {/* Issue Log */}
                  <td className="text-center px-2 py-2 bg-red-50/30">{row.previous?.issueLogCount || 0}</td>
                  <td className="text-center px-2 py-2 bg-red-50/30 font-semibold">{row.current?.issueLogCount || 0}</td>
                  <td className={`text-center px-2 py-2 font-semibold ${getDiffClass(row.diff.issueLogCount)}`}>
                    {formatDiff(row.diff.issueLogCount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                <td className="px-3 py-2 text-gray-800 sticky left-0 bg-gray-100">TOTAL</td>
                
                {/* Mapped DT */}
                <td className="text-center px-2 py-2">{totals.previous.mappedDTWeek}</td>
                <td className="text-center px-2 py-2">{totals.current.mappedDTWeek}</td>
                <td className={`text-center px-2 py-2 ${getDiffClass(totals.current.mappedDTWeek - totals.previous.mappedDTWeek)}`}>
                  {formatDiff(totals.current.mappedDTWeek - totals.previous.mappedDTWeek)}
                </td>
                
                {/* HT Poles */}
                <td className="text-center px-2 py-2">{totals.previous.htPolesWeek}</td>
                <td className="text-center px-2 py-2">{totals.current.htPolesWeek}</td>
                <td className={`text-center px-2 py-2 ${getDiffClass(totals.current.htPolesWeek - totals.previous.htPolesWeek)}`}>
                  {formatDiff(totals.current.htPolesWeek - totals.previous.htPolesWeek)}
                </td>
                
                {/* LT Poles */}
                <td className="text-center px-2 py-2">{totals.previous.ltPolesWeek}</td>
                <td className="text-center px-2 py-2">{totals.current.ltPolesWeek}</td>
                <td className={`text-center px-2 py-2 ${getDiffClass(totals.current.ltPolesWeek - totals.previous.ltPolesWeek)}`}>
                  {formatDiff(totals.current.ltPolesWeek - totals.previous.ltPolesWeek)}
                </td>
                
                {/* Consumer Pts */}
                <td className="text-center px-2 py-2">{totals.previous.consumerPointsWeek}</td>
                <td className="text-center px-2 py-2">{totals.current.consumerPointsWeek}</td>
                <td className={`text-center px-2 py-2 ${getDiffClass(totals.current.consumerPointsWeek - totals.previous.consumerPointsWeek)}`}>
                  {formatDiff(totals.current.consumerPointsWeek - totals.previous.consumerPointsWeek)}
                </td>
                
                {/* Issue Log */}
                <td className="text-center px-2 py-2">{totals.previous.issueLogCount}</td>
                <td className="text-center px-2 py-2">{totals.current.issueLogCount}</td>
                <td className={`text-center px-2 py-2 ${getDiffClass(totals.current.issueLogCount - totals.previous.issueLogCount)}`}>
                  {formatDiff(totals.current.issueLogCount - totals.previous.issueLogCount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-wrap gap-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-green-100 rounded"></span> 
            Positive change (increase)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-red-100 rounded"></span> 
            Negative change (decrease)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-blue-100 rounded"></span> 
            New feeder (not in previous)
          </span>
        </div>
      </div>
    </div>
  );
}
