import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const CLIENT_ID = '86xafi84nrw62l'; // Using the one from user request
const REDIRECT_URI = `${window.location.origin}/auth/linkedin/callback`;
const SCOPE = 'openid profile email';
const STATE = 'velaa_sync_state';

function persistLinkedInProfile(profile: unknown) {
  const user = auth.currentUser;
  if (!user) return;
  return setDoc(
    doc(db, 'users', user.uid),
    { linkedInProfile: profile },
    { merge: true }
  );
}

export function useLinkedInAuth() {
  const [profile, setProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('linkedin_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      console.log('Message received:', e.data);
      if (e.data?.type !== "LINKEDIN_CODE") return;

      const code = e.data.code;
      if (!code) return;

      (async () => {
        try {
          const res = await fetch("/api/linkedin/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          if (!res.ok) throw new Error("LinkedIn callback failed");
          const profile = await res.json();
          setProfile(profile);
          setStatus("success");
          localStorage.setItem("linkedin_profile", JSON.stringify(profile));
          try {
            await persistLinkedInProfile(profile);
          } catch (firestoreErr) {
            console.error("Failed to save LinkedIn profile to Firestore", firestoreErr);
          }
        } catch (err) {
          console.error("LinkedIn code exchange failed", err);
          setStatus("error");
          setError(err instanceof Error ? err.message : "LinkedIn sync failed");
        }
      })();
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== "linkedin_oauth_success" || !e.newValue) return;
      try {
        const { profile } = JSON.parse(e.newValue);
        setProfile(profile);
        setStatus("success");
        persistLinkedInProfile(profile).catch((err) =>
          console.error("Failed to save LinkedIn profile to Firestore", err)
        );
        // We can keep it or remove it. User suggested removing it.
        localStorage.removeItem("linkedin_oauth_success");
      } catch (err) {
        console.error("Storage sync failed", err);
      }
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state: STATE,
    });

    const url = `${LINKEDIN_AUTH_URL}?${params}`;

    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    popupRef.current = window.open(
      url,
      'linkedin_oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    setStatus('pending');
    setError(null);

    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(pollRef.current);
        setStatus((prev) => (prev === 'pending' ? 'idle' : prev));
        popupRef.current = null;
      }
    }, 500);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('linkedin_profile');
    setProfile(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { profile, status, error, login, logout };
}
