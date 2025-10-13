"use client";
import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    let updateInterval: NodeJS.Timeout | null = null;

    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      // Wait for page load before registering
      const handleLoad = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('✅ Service Worker registered:', registration.scope);

            // Check for updates periodically (with better error handling)
            updateInterval = setInterval(() => {
              if (registration.active) {
                registration.update().catch((err) => {
                  // Silently handle invalid state errors (happens during updates)
                  if (err.name !== 'InvalidStateError') {
                    console.warn('Service Worker update check failed:', err);
                  }
                });
              } else {
                // If no active worker, clear the interval
                if (updateInterval) clearInterval(updateInterval);
              }
            }, 60000); // Check every minute

            // Handle updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (
                    newWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    // New service worker available
                    if (confirm('New version available! Reload to update?')) {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('❌ Service Worker registration failed:', error);
          });

        // Handle controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🔄 Service Worker updated');
        });

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'CACHE_UPDATED') {
            console.log('📦 Cache updated:', event.data.url);
          }
        });
      };

      window.addEventListener('load', handleLoad);

      // Cleanup function
      return () => {
        if (updateInterval) clearInterval(updateInterval);
      };
    } else if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // In development, unregister any existing service workers to avoid conflicts
      navigator.serviceWorker?.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then(() => {
            console.log('🧹 Unregistered service worker in development mode');
          });
        });
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
