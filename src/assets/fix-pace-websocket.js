// This script MUST run BEFORE pace.js loads
// It preserves the native WebSocket so we can restore it after pace.js overrides it
(function() {
  'use strict';
  
  // Store native WebSocket IMMEDIATELY before pace.js loads
  if (typeof window !== 'undefined' && window.WebSocket) {
    // Store the native WebSocket constructor
    window.__NATIVE_WEBSOCKET__ = window.WebSocket;
    
    // Also store it in a way pace.js won't overwrite
    Object.defineProperty(window, '__NATIVE_WEBSOCKET_PRESERVED__', {
      value: window.WebSocket,
      writable: false,
      configurable: false,
      enumerable: false
    });
    
    console.log('Preserved native WebSocket before pace.js loads');
  }
  
  // After page loads, restore native WebSocket if pace.js overrode it
  function restoreNativeWebSocket() {
    if (typeof window === 'undefined') return;
    
    var nativeWS = window.__NATIVE_WEBSOCKET_PRESERVED__ || window.__NATIVE_WEBSOCKET__;
    
    if (nativeWS && window.WebSocket !== nativeWS) {
      // Restore native WebSocket
      window.WebSocket = nativeWS;
      console.log('Restored native WebSocket after pace.js conflict');
    }
    
    // Also disable pace.js WebSocket tracking
    if (window.Pace && window.Pace.options) {
      window.Pace.options.ajax = window.Pace.options.ajax || {};
      window.Pace.options.ajax.trackWebSockets = false;
    }
  }
  
  // Run immediately
  restoreNativeWebSocket();
  
  // Run after DOM loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreNativeWebSocket);
  }
  
  // Run after a delay to ensure pace.js has initialized
  setTimeout(restoreNativeWebSocket, 50);
  setTimeout(restoreNativeWebSocket, 100);
  setTimeout(restoreNativeWebSocket, 200);
  setTimeout(restoreNativeWebSocket, 500);
  setTimeout(restoreNativeWebSocket, 1000);
})();

