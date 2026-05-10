/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Combine, 
  Scissors, 
  RotateCw, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  X, 
  Upload,
  Loader2,
  ChevronRight,
  Info
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { mergePDFs, splitPDF, rotatePDF, imagesToPDF } from './lib/pdf';
import { cn, downloadFile } from './lib/utils';
import { GoogleGenAI } from '@google/genai';

type Tool = 'merge' | 'split' | 'rotate' | 'img2pdf' | 'ai-summary';

const TOOLS = [
  { id: 'merge', name: 'Merge PDF', icon: Combine, description: 'Combine multiple PDFs into one.' },
  { id: 'split', name: 'Split PDF', icon: Scissors, description: 'Extract pages or split into individual files.' },
  { id: 'rotate', name: 'Rotate PDF', icon: RotateCw, description: 'Change document orientation.' },
  { id: 'img2pdf', name: 'Images to PDF', icon: ImageIcon, description: 'Convert images to a PDF document.' },
  { id: 'ai-summary', name: 'AI Summary', icon: Sparkles, description: 'Get insights and summaries from your PDF.' },
] as const;

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>('merge');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setAiResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: activeTool === 'img2pdf' 
      ? { 
          'image/jpeg': ['.jpeg', '.jpg'], 
          'image/png': ['.png'] 
        } 
      : { 'application/pdf': ['.pdf'] }
  } as any);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setLoading(true);
    try {
      if (activeTool === 'merge') {
        const buffers = await Promise.all(files.map(f => f.arrayBuffer()));
        const merged = await mergePDFs(buffers);
        downloadFile(merged, 'merged.pdf', 'application/pdf');
      } else if (activeTool === 'split') {
        const buffer = await files[0].arrayBuffer();
        const splitFiles = await splitPDF(buffer);
        splitFiles.forEach((data, i) => {
          downloadFile(data, `page_${i + 1}.pdf`, 'application/pdf');
        });
      } else if (activeTool === 'rotate') {
        const buffer = await files[0].arrayBuffer();
        const rotated = await rotatePDF(buffer, 90);
        downloadFile(rotated, 'rotated.pdf', 'application/pdf');
      } else if (activeTool === 'img2pdf') {
        const imageBuffers = await Promise.all(files.map(async f => ({
          data: await f.arrayBuffer(),
          type: f.type
        })));
        const pdf = await imagesToPDF(imageBuffers);
        downloadFile(pdf, 'converted.pdf', 'application/pdf');
      } else if (activeTool === 'ai-summary') {
        await handleAISummary();
      }
    } catch (error) {
      console.error('Processing failed:', error);
      alert('An error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  const handleAISummary = async () => {
    if (!files[0]) return;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    const buffer = await files[0].arrayBuffer();
    const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    const prompt = 'Please provide a concise summary of this PDF document, highlighting the key points, main arguments, and any important data presented. Use bullet points for readability.';
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { parts: [
            { inlineData: { data: base64, mimeType: 'application/pdf' } },
            { text: prompt }
          ]}
        ]
      });
      
      setAiResult(response.text || 'No summary generated.');
    } catch (error) {
      console.error('AI Error:', error);
      setAiResult('Failed to generate AI summary. Please check your document and try again.');
    }
  };

  const reset = () => {
    setFiles([]);
    setAiResult(null);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Header Navigation */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center rounded">
              <span className="text-white font-bold text-xs">PDFA</span>
            </div>
            <span className="text-xl font-bold tracking-tight">pdfa</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <span className="text-indigo-600 border-b-2 border-indigo-600 h-16 flex items-center">Converter</span>
            <span className="hover:text-slate-900 cursor-pointer h-16 flex items-center">Editor</span>
            <span className="hover:text-slate-900 cursor-pointer h-16 flex items-center">Security</span>
            <span className="hover:text-slate-900 cursor-pointer h-16 flex items-center">Automation</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold uppercase">PD</div>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Tools (Slim) */}
        <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-8 shrink-0">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => { setActiveTool(tool.id); reset(); }}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer relative group",
                activeTool === tool.id 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100" 
                  : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
              )}
              title={tool.name}
            >
              <tool.icon size={20} />
              <div className="absolute left-14 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {tool.name}
              </div>
            </button>
          ))}
        </aside>

        {/* Workspace Center */}
        <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
          <div className="flex justify-between items-end shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {TOOLS.find(t => t.id === activeTool)?.name}
              </h1>
              <p className="text-slate-500 text-sm">
                {TOOLS.find(t => t.id === activeTool)?.description}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={reset}
                className="px-4 py-2 border border-slate-300 rounded-md bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                disabled={files.length === 0}
              >
                Clear All
              </button>
              <button 
                {...getRootProps()}
                className="px-4 py-2 bg-indigo-600 rounded-md text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                Add New Files
                <input {...getInputProps()} />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {files.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-48 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center bg-white shrink-0 cursor-pointer hover:border-indigo-300 transition-colors"
                {...getRootProps()}
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  Drag and drop files here, or <span className="text-indigo-600 cursor-pointer">browse files</span>
                </p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-tight">
                  {activeTool === 'img2pdf' ? 'Supports: JPG, PNG' : 'Supports: PDF documents'} (Max 50MB)
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="workspace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col gap-6 overflow-hidden"
              >
                {/* File Queue */}
                <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                  <div className="grid grid-cols-12 bg-slate-50 px-6 py-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-6">File Name</div>
                    <div className="col-span-2 text-center">Size</div>
                    <div className="col-span-2 text-center">Action</div>
                    <div className="col-span-2 text-right">Status</div>
                  </div>
                  <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                    {files.map((file, i) => (
                      <div key={i} className="grid grid-cols-12 px-6 py-4 items-center text-sm group">
                        <div className="col-span-6 flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded flex items-center justify-center font-bold text-[10px]",
                            file.type.includes('image') ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                          )}>
                            {file.name.split('.').pop()?.toUpperCase()}
                          </div>
                          <span className="font-medium truncate">{file.name}</span>
                        </div>
                        <div className="col-span-2 text-center text-slate-500 font-mono text-xs">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                        <div className="col-span-2 text-center">
                          <button 
                            onClick={() => removeFile(i)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-indigo-600 font-semibold">Ready</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Snippet - if result exists */}
                {aiResult && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-h-64 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                       <Sparkles size={16} className="text-indigo-600" />
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-500">AI Summary Results</span>
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {aiResult}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Settings Panel */}
        <aside className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col shrink-0 overflow-hidden">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6">Process Settings</h2>
          
          <div className="space-y-6 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Output Standard</label>
              <div className="relative">
                <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all">
                  <option>PDF/A (ISO Standard)</option>
                  <option>Standard Web PDF</option>
                  <option>High Quality Print</option>
                  <option>Minimal Size</option>
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                  <ChevronRight size={16} className="text-slate-400 rotate-90" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Advanced Features</label>
              {[
                { label: 'Apply Metadata', active: true },
                { label: 'Embed Fonts', active: true },
                { label: 'Linearize PDF', active: false },
              ].map((opt, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={cn("text-sm", opt.active ? "text-slate-700" : "text-slate-400")}>{opt.label}</span>
                  <div className={cn(
                    "w-10 h-5 rounded-full flex items-center px-0.5 transition-colors cursor-pointer",
                    opt.active ? "bg-indigo-600 justify-end" : "bg-slate-200 justify-start"
                  )}>
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">File capacity</span>
                  <span className="text-slate-800 font-bold">{Math.round((files.length / 10) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (files.length / 10) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={files.length === 0 || loading}
            className={cn(
              "w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-slate-200 mt-auto transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none hover:bg-slate-800 flex items-center justify-center gap-2",
              loading && "animate-pulse"
            )}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Download size={18} />
            )}
            {activeTool === 'ai-summary' ? 'RUN ANALYSIS' : `PROCESS ${files.length > 0 ? `(${files.length} FILES)` : 'ALL'}`}
          </button>
        </aside>
      </main>

      {/* Status Bar */}
      <footer className="h-10 bg-slate-900 text-white flex items-center px-6 justify-between text-[10px] uppercase tracking-widest shrink-0 font-medium">
        <div className="flex gap-6">
          <span>Version 4.2.0-STABLE</span>
          <span className="text-slate-500">•</span>
          <span>System Status: Optimal</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> 
            Cloud Sync Active
          </span>
          <span className="text-slate-700">|</span>
          <span>Support: ID #7284-A</span>
        </div>
      </footer>
    </div>
  );
}
