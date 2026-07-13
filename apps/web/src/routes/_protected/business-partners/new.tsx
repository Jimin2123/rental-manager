import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/business-partners/new')({
  beforeLoad: () => {
    throw redirect({ to: '/customers/new' });
  },
  component: () => null,
});
