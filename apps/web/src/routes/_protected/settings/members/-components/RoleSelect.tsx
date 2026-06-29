import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { NativeSelect } from '@/components/ui/native-select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../-types';

export function RoleSelect<T extends FieldValues>({ control, name }: { control: Control<T>; name: FieldPath<T> }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>역할</FormLabel>
          <FormControl>
            <NativeSelect
              className="shadow-xs"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
