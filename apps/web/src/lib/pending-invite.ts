const KEY = 'pending_invite_token';
export const storePendingInvite = (token: string) => sessionStorage.setItem(KEY, token);
export const consumePendingInvite = (): string | null => {
  const t = sessionStorage.getItem(KEY);
  if (t) sessionStorage.removeItem(KEY);
  return t;
};
