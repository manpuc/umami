'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Column, Row, Text } from '@umami/react-zen';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '@/components/hooks';
import { TwoFactorRegenerateModal } from '@/components/modals/TwoFactorRegenerateModal';

export function TwoFactorBackupCodesSection() {
  const { get, useQuery } = useApi();
  const queryClient = useQueryClient();
  const [showRegenerate, setShowRegenerate] = useState(false);

  const { data, isLoading } = useQuery<{ remaining: number; total: number }>({
    queryKey: ['2fa-backup-codes'],
    queryFn: () => get('/2fa/backup-codes'),
    refetchOnWindowFocus: true,
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['2fa-backup-codes'] });
  };

  if (isLoading || !data) return null;

  return (
    <Column
      gap="3"
      style={{
        marginTop: 8,
        paddingTop: 16,
        borderTop: '1px solid var(--border-color, #e5e7eb)',
      }}
    >
      <Row alignItems="center" justifyContent="space-between" wrap="wrap" gap="3">
        <Row alignItems="center" gap="2">
          <KeyRound size={18} style={{ opacity: 0.7 }} />
          <Text weight="bold">Backup Codes</Text>
          <Text color="muted" size="sm">
            ({data.remaining} of {data.total} remaining)
          </Text>
        </Row>
        <Button variant="outline" size="sm" onPress={() => setShowRegenerate(true)}>
          Regenerate Codes
        </Button>
      </Row>

      {showRegenerate && (
        <TwoFactorRegenerateModal
          onClose={() => setShowRegenerate(false)}
          onSuccess={handleSuccess}
        />
      )}
    </Column>
  );
}
