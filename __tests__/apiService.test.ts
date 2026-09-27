import { apiService } from '../src/services/apiService';

describe('apiService', () => {
  it('listHistory throws not configured error', async () => {
    await expect(apiService.listHistory()).rejects.toThrow('API REST no configurada todavía');
  });

  it('appendHistory throws not configured error', async () => {
    await expect(
      apiService.appendHistory({
        uid: null,
        content: 'https://example.com/x',
        operation: 'WRITE',
        verified: true,
      }),
    ).rejects.toThrow('API REST no configurada todavía');
  });
});
