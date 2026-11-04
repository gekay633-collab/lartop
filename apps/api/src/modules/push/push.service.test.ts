import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { endpointPushPermitido } from './push.service.js';

describe('validação de endpoints Web Push', () => {
  it('aceita servidores conhecidos dos principais navegadores', () => {
    assert.equal(endpointPushPermitido('https://fcm.googleapis.com/fcm/send/abc'), true);
    assert.equal(endpointPushPermitido('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
    assert.equal(endpointPushPermitido('https://web.push.apple.com/QM1/abc'), true);
    assert.equal(endpointPushPermitido('https://example.notify.windows.com/w/?token=abc'), true);
  });
  it('bloqueia destinos locais, credenciais e protocolos inseguros (SSRF)', () => {
    for (const endpoint of [
      'http://localhost:3000/private',
      'https://localhost/private',
      'https://127.0.0.1/private',
      'http://169.254.169.254/metadata',
      'https://fcm.googleapis.com.evil.example/send',
      'https://user:password@fcm.googleapis.com/send',
      'https://fcm.googleapis.com:8080/send',
      'https://fcm.googleapis.com./send',
      'https://fcm.googleapis.com/#secret',
    ]) assert.equal(endpointPushPermitido(endpoint), false, endpoint);
  });
});
