import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { CampaignState } from '../types/jjk';
import { sanitizeCampaignForCloud } from '../utils/jjkEngine';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export interface CloudCampaignSummary {
  id: string;
  title: string;
  characterName: string;
  characterGrade: string;
  arc: string;
  location: string;
  turnCount: number;
  updatedAtIso: string;
  campaignPayload: string;
}

export async function saveCampaignToCloud(state: CampaignState): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const { campaignId, docData } = sanitizeCampaignForCloud(state, currentUser.uid);
  const path = `campaigns/${campaignId}`;
  const docRef = doc(db, 'campaigns', campaignId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      await setDoc(docRef, {
        ...docData,
        createdAt: existingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...docData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listUserCloudCampaigns(): Promise<CloudCampaignSummary[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return [];

  const path = 'campaigns';
  try {
    const q = query(collection(db, 'campaigns'), where('ownerId', '==', currentUser.uid));
    const snap = await getDocs(q);
    const items: CloudCampaignSummary[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const updatedDate = d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : new Date().toISOString();
      items.push({
        id: docSnap.id,
        title: String(d.title || 'Campanha Jujutsu'),
        characterName: String(d.characterName || 'Feiticeiro'),
        characterGrade: String(d.characterGrade || 'Grau 3'),
        arc: String(d.arc || ''),
        location: String(d.location || ''),
        turnCount: Number(d.turnCount || 0),
        updatedAtIso: updatedDate,
        campaignPayload: String(d.campaignPayload || '{}'),
      });
    });
    return items.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCloudCampaign(campaignId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  const path = `campaigns/${campaignId}`;
  try {
    await deleteDoc(doc(db, 'campaigns', campaignId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
