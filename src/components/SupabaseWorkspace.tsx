'use client'

import Workspace from "./Workspace";
import { useSupabaseQuestions } from "../hooks/useSupabaseQuestions";

export default function SupabaseWorkspace() {
  const {
    questions,
    loading,
    error,
    refetch,
  } = useSupabaseQuestions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white p-8" style={{ backgroundColor: '#0E172A' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white gap-4 p-8" style={{ backgroundColor: '#0E172A' }}>
        <h2 className="text-xl font-bold">Error Loading Questions</h2>
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl transition-colors text-white font-bold text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white gap-4 p-8" style={{ backgroundColor: '#0E172A' }}>
        <h2 className="text-xl font-bold">No Questions Found</h2>
        <p className="text-slate-400">No questions match your current filters.</p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2 bg-amber-500 hover:bg-amber-600 rounded-2xl transition-colors text-white font-bold text-sm"
        >
          Reset & Reload
        </button>
      </div>
    );
  }

  return (
    <Workspace questions={questions} />
  );
}