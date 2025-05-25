import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { homeAssistantService } from '../services/homeassistant';

export function useHomeAssistant() {
  const [error, setError] = useState<Error | null>(null);

  const getStates = useCallback(async () => {
    try {
      setError(null);
      if (!homeAssistantService) {
        throw new Error('HomeAssistant service is not configured. Please check your environment variables.');
      }
      return await homeAssistantService.getStates();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const getEntityHistory = useCallback(async (entityId: string, startTime: string, endTime: string) => {
    try {
      setError(null);
      if (!homeAssistantService) {
        throw new Error('HomeAssistant service is not configured. Please check your environment variables.');
      }
      return await homeAssistantService.getEntityHistory(entityId, startTime, endTime);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const getEntities = useCallback(async () => {
    try {
      setError(null);
      if (!homeAssistantService) {
        throw new Error('HomeAssistant service is not configured. Please check your environment variables.');
      }
      return await homeAssistantService.getEntities();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const useEntities = () => {
    return useQuery({
      queryKey: ['homeAssistantEntities'],
      queryFn: getEntities,
      retry: 1,
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  };

  const useEntityHistory = (entityId: string, startTime: string, endTime: string) => {
    return useQuery({
      queryKey: ['homeAssistantHistory', entityId, startTime, endTime],
      queryFn: () => getEntityHistory(entityId, startTime, endTime),
      enabled: Boolean(entityId && startTime && endTime),
    });
  };

  return {
    getStates,
    getEntityHistory,
    getEntities,
    useEntities,
    useEntityHistory,
    error,
  };
} 