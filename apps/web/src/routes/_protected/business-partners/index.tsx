import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/business-partners/')({
  beforeLoad: () => {
    throw redirect({ to: '/customers', search: { tab: 'partners', q: '' } });
  },
  component: () => null,
});
