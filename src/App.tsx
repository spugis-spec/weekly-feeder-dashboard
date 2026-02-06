import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ReportTable } from './components/ReportTable';
import { ComparisonView } from './components/ComparisonView';
import { SummaryCards } from './components/SummaryCards';
import { FeederCorrectionModal } from './components/FeederCorrectionModal';
import {
  parseFeederLookup,
  parseAssetFile,
  getFeederFromRow,
  getTimeFromRow,
  isDateInRange,
  exportReportToExcel,
  getAllFeederNames,
  saveReportToStorage,
  loadReportFromStorage,
  getWeekLabel,
} from './utils/excelUtils';
import type { FeederLookup, FeederReportRow, UnmatchedFeeder, SavedReport } from './types';

type Tab = 'upload' | 'report' | 'previous' | 'comparison';

export function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('upload');

  // File states
  const [feederLookupFile, setFeederLookupFile] = useState<File | null>(null);
  const [mappedDTFile, setMappedDTFile] = useState<File | null>(null);
  const [htPolesFile, setHtPolesFile] = useState<File | null>(null);
  const [ltPolesFile, setLtPolesFile] = useState<File | null>(null);
  const [consumerPointsFile, setConsumerPointsFile] = useState<File | null>(null);
  const [issueLogFile, setIssueLogFile] = useState<File | null>(null);

  // Parsed data states
  const [feederLookup, setFeederLookup] = useState<FeederLookup>({});
  const [allFeederNames, setAllFeederNames] = useState<string[]>([]);
  const [reportData, setReportData] = useState<FeederReportRow[]>([]);
  const [savedPreviousReport, setSavedPreviousReport] = useState<SavedReport | null>(null);
  
  // Current report metadata
  const [currentDateRange, setCurrentDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  
  // Unmatched feeders for correction
  const [unmatchedFeeders, setUnmatchedFeeders] = useState<UnmatchedFeeder[]>([]);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // Date range
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load saved feeder lookup and previous report from storage on mount
  useEffect(() => {
    // Load previous week report
    const saved = loadReportFromStorage('previousWeekReport');
    if (saved) {
      setSavedPreviousReport(saved);
    }
    
    // Load saved feeder lookup
    try {
      const savedLookup = localStorage.getItem('feederLookup');
      const savedFeeders = localStorage.getItem('allFeederNames');
      if (savedLookup && savedFeeders) {
        setFeederLookup(JSON.parse(savedLookup));
        setAllFeederNames(JSON.parse(savedFeeders));
      }
    } catch (e) {
      console.error('Failed to load saved feeder lookup:', e);
    }
  }, []);

  // Clear messages after timeout
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setError(null);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccessMessage(null);
    setTimeout(() => setError(null), 5000);
  };

  // Handle feeder lookup upload
  const handleFeederLookupUpload = async () => {
    if (!feederLookupFile) {
      showError('Please select a feeder lookup file');
      return;
    }
    setIsLoading(true);
    try {
      const lookup = await parseFeederLookup(feederLookupFile);
      setFeederLookup(lookup);
      const feeders = getAllFeederNames(lookup);
      setAllFeederNames(feeders);
      
      // Save to localStorage for persistence
      localStorage.setItem('feederLookup', JSON.stringify(lookup));
      localStorage.setItem('allFeederNames', JSON.stringify(feeders));
      
      showSuccess(`Loaded and saved ${Object.keys(lookup).length} feeder mappings (will persist across sessions)`);
    } catch (err) {
      showError('Failed to parse feeder lookup file');
      console.error(err);
    }
    setIsLoading(false);
  };
  
  // Clear saved feeder lookup
  const clearFeederLookup = () => {
    localStorage.removeItem('feederLookup');
    localStorage.removeItem('allFeederNames');
    setFeederLookup({});
    setAllFeederNames([]);
    setFeederLookupFile(null);
    showSuccess('Feeder lookup cleared');
  };

  // Generate report from asset files
  const generateReport = useCallback(async () => {
    if (!startDate || !endDate) {
      showError('Please select date range');
      return;
    }

    const dtStart = new Date(startDate);
    const dtEnd = new Date(endDate);

    if (dtStart > dtEnd) {
      showError('Start date must be before end date');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parse all asset files
      const [mappedDT, htPoles, ltPoles, consumerPoints, issueLog] = await Promise.all([
        mappedDTFile ? parseAssetFile(mappedDTFile) : Promise.resolve([]),
        htPolesFile ? parseAssetFile(htPolesFile) : Promise.resolve([]),
        ltPolesFile ? parseAssetFile(ltPolesFile) : Promise.resolve([]),
        consumerPointsFile ? parseAssetFile(consumerPointsFile) : Promise.resolve([]),
        issueLogFile ? parseAssetFile(issueLogFile) : Promise.resolve([]),
      ]);

      // Aggregate data by feeder
      const feederData: Record<string, FeederReportRow> = {};
      const unmatchedIssues: Record<string, UnmatchedFeeder> = {};

      const getOrCreateFeeder = (name: string, rawName: string): FeederReportRow => {
        if (!feederData[name]) {
          feederData[name] = {
            feederName: name,
            rawFeederName: rawName,
            mappedDTWeek: 0,
            mappedDTTotal: 0,
            htPolesWeek: 0,
            htPolesTotal: 0,
            ltPolesWeek: 0,
            ltPolesTotal: 0,
            consumerPointsWeek: 0,
            consumerPointsTotal: 0,
            issueLogCount: 0,
          };
        }
        return feederData[name];
      };

      // Process Mapped DT by GIS
      mappedDT.forEach((row) => {
        const { matched, raw } = getFeederFromRow(row, feederLookup, allFeederNames);
        if (!matched) return;
        
        const feederRow = getOrCreateFeeder(matched, raw);
        const time = getTimeFromRow(row);
        const isWeek = isDateInRange(time, dtStart, dtEnd);
        
        feederRow.mappedDTTotal += 1;
        if (isWeek) feederRow.mappedDTWeek += 1;
      });

      // Process HT Poles (combines 11kv and 33kv)
      htPoles.forEach((row) => {
        const { matched, raw } = getFeederFromRow(row, feederLookup, allFeederNames);
        if (!matched) return;
        
        const feederRow = getOrCreateFeeder(matched, raw);
        const time = getTimeFromRow(row);
        const isWeek = isDateInRange(time, dtStart, dtEnd);
        
        feederRow.htPolesTotal += 1;
        if (isWeek) feederRow.htPolesWeek += 1;
      });

      // Process LT Poles
      ltPoles.forEach((row) => {
        const { matched, raw } = getFeederFromRow(row, feederLookup, allFeederNames);
        if (!matched) return;
        
        const feederRow = getOrCreateFeeder(matched, raw);
        const time = getTimeFromRow(row);
        const isWeek = isDateInRange(time, dtStart, dtEnd);
        
        feederRow.ltPolesTotal += 1;
        if (isWeek) feederRow.ltPolesWeek += 1;
      });

      // Process Consumer Points
      consumerPoints.forEach((row) => {
        const { matched, raw } = getFeederFromRow(row, feederLookup, allFeederNames);
        if (!matched) return;
        
        const feederRow = getOrCreateFeeder(matched, raw);
        const time = getTimeFromRow(row);
        const isWeek = isDateInRange(time, dtStart, dtEnd);
        
        feederRow.consumerPointsTotal += 1;
        if (isWeek) feederRow.consumerPointsWeek += 1;
      });

      // Process Issue Log - track unmatched feeders
      issueLog.forEach((row) => {
        const { matched, raw } = getFeederFromRow(row, feederLookup, allFeederNames);
        if (!matched) return;
        
        const time = getTimeFromRow(row);
        const isWeek = isDateInRange(time, dtStart, dtEnd);
        
        if (!isWeek) return;
        
        // Check if feeder is in known feeders list
        const isKnown = allFeederNames.some(f => f.toLowerCase() === matched.toLowerCase());
        
        if (isKnown || Object.keys(feederData).some(f => f.toLowerCase() === matched.toLowerCase())) {
          const feederRow = getOrCreateFeeder(matched, raw);
          feederRow.issueLogCount += 1;
        } else {
          // Track unmatched for correction
          if (!unmatchedIssues[raw]) {
            unmatchedIssues[raw] = {
              originalName: raw,
              correctedName: '',
              count: 0,
            };
          }
          unmatchedIssues[raw].count += 1;
        }
      });

      const reportRows = Object.values(feederData).sort((a, b) => 
        a.feederName.localeCompare(b.feederName)
      );

      const unmatchedList = Object.values(unmatchedIssues);

      setReportData(reportRows);
      setCurrentDateRange({ start: startDate, end: endDate });
      setUnmatchedFeeders(unmatchedList);
      
      if (unmatchedList.length > 0) {
        setShowCorrectionModal(true);
      }
      
      showSuccess(`Report generated with ${reportRows.length} feeders${unmatchedList.length > 0 ? ` (${unmatchedList.length} unmatched issue log feeders need correction)` : ''}`);
      setActiveTab('report');
    } catch (err) {
      showError('Failed to generate report');
      console.error(err);
    }

    setIsLoading(false);
  }, [startDate, endDate, mappedDTFile, htPolesFile, ltPolesFile, consumerPointsFile, issueLogFile, feederLookup, allFeederNames]);

  // Handle feeder correction from modal
  const handleFeederCorrection = (corrections: UnmatchedFeeder[]) => {
    const newReportData = [...reportData];
    
    corrections.forEach(correction => {
      if (correction.correctedName) {
        const existingRow = newReportData.find(r => r.feederName.toLowerCase() === correction.correctedName.toLowerCase());
        if (existingRow) {
          existingRow.issueLogCount += correction.count;
        } else {
          newReportData.push({
            feederName: correction.correctedName,
            rawFeederName: correction.originalName,
            mappedDTWeek: 0,
            mappedDTTotal: 0,
            htPolesWeek: 0,
            htPolesTotal: 0,
            ltPolesWeek: 0,
            ltPolesTotal: 0,
            consumerPointsWeek: 0,
            consumerPointsTotal: 0,
            issueLogCount: correction.count,
          });
        }
      }
    });
    
    setReportData(newReportData.sort((a, b) => a.feederName.localeCompare(b.feederName)));
    setUnmatchedFeeders([]);
    setShowCorrectionModal(false);
    showSuccess('Feeder corrections applied');
  };

  // Handle feeder name edit in report table
  const handleFeederNameEdit = (index: number, newFeederName: string) => {
    const newData = [...reportData];
    newData[index] = {
      ...newData[index],
      feederName: newFeederName,
      isEdited: true,
    };
    setReportData(newData);
  };

  // Handle data update from report table
  const handleReportDataUpdate = (newData: FeederReportRow[]) => {
    setReportData(newData);
  };

  // Save current report as previous week
  const saveCurrentAsPrevious = () => {
    if (reportData.length === 0) {
      showError('No report data to save');
      return;
    }
    
    const report: SavedReport = {
      data: reportData,
      dateRange: currentDateRange,
      savedAt: new Date().toISOString(),
      weekLabel: getWeekLabel(currentDateRange.start, currentDateRange.end),
    };
    
    saveReportToStorage(report, 'previousWeekReport');
    setSavedPreviousReport(report);
    showSuccess('Report saved as Previous Week');
  };

  // Export current report
  const exportCurrentReport = () => {
    if (reportData.length === 0) {
      showError('No report data to export');
      return;
    }
    
    const filename = `Feeder_Report_${currentDateRange.start}_to_${currentDateRange.end}.xlsx`;
    exportReportToExcel(reportData, filename, currentDateRange);
    showSuccess('Report exported successfully');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Feeder Correction Modal */}
      {showCorrectionModal && unmatchedFeeders.length > 0 && (
        <FeederCorrectionModal
          unmatchedFeeders={unmatchedFeeders}
          allFeeders={allFeederNames}
          onCorrect={handleFeederCorrection}
          onClose={() => setShowCorrectionModal(false)}
        />
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Feeder Capture Dashboard</h1>
                <p className="text-sm text-gray-500">Upload, analyze, and compare feeder capture data</p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <nav className="flex gap-2 flex-wrap">
              {[
                { id: 'upload', label: 'Upload & Config', icon: '📁' },
                { id: 'report', label: 'Generated Report', icon: '📊', badge: reportData.length > 0 ? reportData.length : undefined },
                { id: 'previous', label: 'Previous Week', icon: '📋', badge: savedPreviousReport?.data.length },
                { id: 'comparison', label: 'Comparison', icon: '🔄' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.icon} {tab.label}
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Messages */}
      {(error || successMessage) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {successMessage}
            </div>
          )}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Feeder Lookup Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-purple-100 rounded-lg">🔗</span>
                Feeder Lookup (Saved Permanently)
              </h2>
              
              {/* Show saved lookup status */}
              {Object.keys(feederLookup).length > 0 ? (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-green-800 font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Feeder Lookup Loaded & Saved
                      </p>
                      <p className="text-green-600 text-sm mt-1">
                        {Object.keys(feederLookup).length} mappings • {allFeederNames.length} unique feeders • Persists across sessions
                      </p>
                    </div>
                    <button
                      onClick={clearFeederLookup}
                      className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Clear & Re-upload
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 text-sm">
                    ⚠️ No feeder lookup loaded. Upload a lookup file to enable feeder name matching.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUpload
                  label="Feeder Lookup File"
                  description="Map feeder codes to readable names"
                  file={feederLookupFile}
                  onFileSelect={setFeederLookupFile}
                />
                <div className="flex items-end">
                  <button
                    onClick={handleFeederLookupUpload}
                    disabled={!feederLookupFile || isLoading}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Loading...' : Object.keys(feederLookup).length > 0 ? 'Update Lookup' : 'Load Lookup'}
                  </button>
                </div>
              </div>
            </div>

            {/* Asset Files Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 rounded-lg">📂</span>
                Asset Files (Upload Separately)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FileUpload
                  label="Mapped DT by GIS"
                  description="Distribution Transformer mapping data"
                  file={mappedDTFile}
                  onFileSelect={setMappedDTFile}
                />
                <FileUpload
                  label="HT Poles"
                  description="High Tension poles (11kv + 33kv combined)"
                  file={htPolesFile}
                  onFileSelect={setHtPolesFile}
                />
                <FileUpload
                  label="LT Poles"
                  description="Low Tension poles data"
                  file={ltPolesFile}
                  onFileSelect={setLtPolesFile}
                />
                <FileUpload
                  label="Consumer Points Captured"
                  description="Consumer enumeration data"
                  file={consumerPointsFile}
                  onFileSelect={setConsumerPointsFile}
                />
                <FileUpload
                  label="Issue Log"
                  description="Reported issues data"
                  file={issueLogFile}
                  onFileSelect={setIssueLogFile}
                />
              </div>
            </div>

            {/* Date Range & Generate Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-green-100 rounded-lg">📅</span>
                Date Range & Generate Report
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={generateReport}
                    disabled={isLoading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      '🚀 Generate Report'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated Report Tab */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            {/* Action buttons */}
            {reportData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      Generated Report: {currentDateRange.start && getWeekLabel(currentDateRange.start, currentDateRange.end)}
                    </h3>
                    <p className="text-sm text-gray-500">{reportData.length} feeders captured</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={saveCurrentAsPrevious}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save as Previous Week
                    </button>
                    <button
                      onClick={exportCurrentReport}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Excel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <SummaryCards data={reportData} />
            
            <ReportTable 
              data={reportData} 
              title="Generated Feeder Summary Report"
              allFeeders={allFeederNames}
              onFeederNameEdit={handleFeederNameEdit}
              onDataUpdate={handleReportDataUpdate}
              editable={true}
            />
            
            {unmatchedFeeders.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-amber-800 font-semibold mb-2">⚠️ Unmatched Issue Log Feeders</h3>
                <p className="text-amber-700 text-sm mb-3">
                  {unmatchedFeeders.length} feeders from Issue Log could not be matched. Click below to correct them.
                </p>
                <button
                  onClick={() => setShowCorrectionModal(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Correct Feeder Names
                </button>
              </div>
            )}
          </div>
        )}

        {/* Previous Week Tab */}
        {activeTab === 'previous' && (
          <div className="space-y-6">
            {savedPreviousReport ? (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        Saved Previous Week: {savedPreviousReport.weekLabel}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Saved on {new Date(savedPreviousReport.savedAt).toLocaleDateString()} • {savedPreviousReport.data.length} feeders
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const filename = `Previous_Week_${savedPreviousReport.dateRange.start}_to_${savedPreviousReport.dateRange.end}.xlsx`;
                        exportReportToExcel(savedPreviousReport.data, filename, savedPreviousReport.dateRange);
                        showSuccess('Previous week report exported');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Excel
                    </button>
                  </div>
                </div>
                
                <SummaryCards data={savedPreviousReport.data} />
                
                <ReportTable 
                  data={savedPreviousReport.data} 
                  title={`Previous Week Report: ${savedPreviousReport.weekLabel}`}
                  allFeeders={allFeederNames}
                  editable={false}
                />
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Previous Week Report Saved</h3>
                <p className="text-gray-500 mb-4">
                  Generate a report and click "Save as Previous Week" to store it here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Comparison Tab */}
        {activeTab === 'comparison' && (
          <ComparisonView
            currentReport={reportData}
            currentDateRange={currentDateRange}
            previousReport={savedPreviousReport}
            onExport={(data, filename) => {
              exportReportToExcel(data, filename, currentDateRange);
              showSuccess('Comparison report exported');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Feeder Capture Dashboard • Built for efficient asset data management
          </p>
        </div>
      </footer>
    </div>
  );
}
