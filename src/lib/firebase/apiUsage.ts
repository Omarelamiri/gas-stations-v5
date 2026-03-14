// src/lib/firebase/apiUsage.ts
import { db } from './config';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';

const QUOTAS = {
  maps_js_api: 100, // Free tier limit
  routes_api: 322, // Free tier limit (replacing distance_matrix_api)
};

// Get today's date in YYYY-MM-DD format
function getTodayId(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ApiType = 'maps_js_api' | 'routes_api';

export interface ApiUsageData {
  maps_js_api: number;
  routes_api: number;
  date: string;
}

/**
 * Fetches the current day's API usage from Firestore
 */
export async function getApiUsage(): Promise<ApiUsageData> {
  try {
    const docRef = doc(db, 'api_usage', getTodayId());
    const snap = await getDoc(docRef);
    
    const data = snap.exists() ? snap.data() ?? {} : {};
    
    return {
      maps_js_api: data.maps_js_api ?? 0,
      routes_api: data.routes_api ?? data.distance_matrix_api ?? 0,
      date: data.date ?? getTodayId(),
    };
  } catch (error) {
    console.error('Error fetching API usage:', error);
    throw error;
  }
}

/**
 * Increments the usage counter for a specific API
 */
export async function incrementApiUsage(
  api: ApiType,
  amount: number = 1
): Promise<void> {
  try {
    const docRef = doc(db, 'api_usage', getTodayId());
    await setDoc(
      docRef,
      {
        [api]: increment(amount),
        date: getTodayId(),
      },
      { merge: true }
    );
    console.log(`${api} usage incremented by ${amount}`);
  } catch (error) {
    console.error(`Error incrementing ${api} usage:`, error);
    throw error;
  }
}

/**
 * Gets the remaining quota for a specific API
 */
export function getRemaining(api: ApiType, used: number): number {
  return Math.max(QUOTAS[api] - used, 0);
}

/**
 * Checks if an API can still be used
 */
export function canUseApi(api: ApiType, used: number, requestAmount: number = 1): boolean {
  return getRemaining(api, used) >= requestAmount;
}

/**
 * Gets quota information for an API
 */
export function getQuotaInfo(api: ApiType, used: number) {
  const limit = QUOTAS[api];
  const remaining = getRemaining(api, used);
  const percentage = (remaining / limit) * 100;
  
  return {
    used,
    limit,
    remaining,
    percentage,
    exceeded: remaining === 0,
  };
}