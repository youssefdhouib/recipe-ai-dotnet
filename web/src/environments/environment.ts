// Production build (Docker): nginx serves the app and forwards /api and /uploads to the API,
// so relative URLs are enough and the same image works on any domain.
export const environment = {
  apiUrl: '/api',
  fileBaseUrl: '',
};
