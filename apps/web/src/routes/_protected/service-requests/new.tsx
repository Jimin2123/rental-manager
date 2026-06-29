import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ServiceRequestForm } from './-components/ServiceRequestForm';

export const Route = createFileRoute('/_protected/service-requests/new')({
  component: NewServiceRequestPage,
});

function NewServiceRequestPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/service-requests' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">AS 접수 등록</h1>
      </div>
      <ServiceRequestForm />
    </div>
  );
}
