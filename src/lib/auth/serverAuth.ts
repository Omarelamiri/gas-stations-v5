// src/lib/auth/serverAuth.ts
import { auth } from 'firebase-admin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { NextRequest } from 'next/server';

// Initialize Firebase Admin SDK (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * Verifies Firebase Auth token from request headers
 * @param request - NextRequest object
 * @returns userId if valid, null if invalid/missing
 */
export async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  try {
    // Check Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Missing or invalid Authorization header');
      return null;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      console.warn('No token found in Authorization header');
      return null;
    }

    // Verify the token using Firebase Admin SDK
    const decodedToken = await auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Verifies token and returns full decoded token with claims
 */
export async function verifyAuthTokenWithClaims(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) return null;

    const decodedToken = await auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification with claims failed:', error);
    return null;
  }
}

/**
 * Check if user has admin role
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const decodedToken = await verifyAuthTokenWithClaims(request);
  return decodedToken?.admin === true || false;
}