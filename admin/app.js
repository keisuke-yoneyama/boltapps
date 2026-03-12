import { auth, isDevelopmentEnvironment } from '../js/modules/firebase.js';
import {
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { initAdminApp } from '../js/admin/calendar.js';

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await initAdminApp();
  } else {
    try {
      if (
        isDevelopmentEnvironment &&
        typeof __initial_auth_token !== 'undefined' &&
        __initial_auth_token
      ) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
      // ログイン成功後に再度 onAuthStateChanged が発火して initAdminApp が呼ばれる
    } catch (err) {
      console.error('[admin] Auth Error:', err);
    }
  }
});
