import { useState, useEffect, useCallback } from 'react';
import type { Question } from '../data/questions';
import { getQuestions, getDistinctValues, getSubjects } from '../lib/questionService';

export function useSupabaseQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ FIX: useCallback gives refetch a stable reference — 
  // without this, every render creates a new function, which
  // triggers useEffect in SupabaseWorkspace infinitely
  const refetch = useCallback(async (filters: {
    subject?: string;
    topic?: string;
    chapter?: string;
    difficulty?: string;
    type?: string;
  } = {}) => {
    setLoading(true);
    try {
      const data = await getQuestions(filters);
      setQuestions(data);
      setError(null);
    } catch (err) {
      setError('Failed to load questions');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []); // ← empty deps: function never changes

  useEffect(() => {
    // Fetch filter options once on mount
    const fetchOptions = async () => {
      try {
        const [allSubjects, allTopics, allChapters, allDiff, allTypes] = await Promise.all([
          getSubjects(),
          getDistinctValues('topic'),
          getDistinctValues('chapter'),
          getDistinctValues('difficulty'),
          getDistinctValues('type'),
        ]);
        setSubjects(allSubjects);
        setTopics(allTopics);
        setChapters(allChapters);
        setDifficulties(allDiff);
        setTypes(allTypes);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };

    fetchOptions();
    refetch(); // initial load
  }, [refetch]); // ← safe now because refetch is stable

  return {
    questions,
    subjects,
    topics,
    chapters,
    difficulties,
    types,
    loading,
    error,
    refetch,
  };
}