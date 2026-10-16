'use client';
import {
  Button,
  Column,
  Dialog,
  Form,
  FormButtons,
  FormField,
  FormSubmitButton,
  Modal,
  PasswordField,
  Text,
} from '@umami/react-zen';
import { useState } from 'react';
import { ControlledDialog } from '@/components/common/ControlledDialog';
import { OtpInput } from '@/components/common/OtpInput';
import { useApi, useMessages } from '@/components/hooks';
import { TwoFactorSuccessModal } from './TwoFactorSuccessModal';

interface TwoFactorRegenerateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function TwoFactorRegenerateModal({ onClose, onSuccess }: TwoFactorRegenerateModalProps) {
  const { t, labels, getErrorMessage } = useMessages();
  const { post } = useApi();
  const [otpValue, setOtpValue] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<any>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const handleSubmit = async () => {
    setIsPending(true);
    setError(null);
    try {
      const payload: { password?: string; token?: string } = {};
      if (password) payload.password = password;
      if (otpValue) payload.token = otpValue;

      const res = await post('/2fa/backup-codes', payload);
      if (res?.backupCodes) {
        setNewCodes(res.backupCodes);
        onSuccess();
      }
    } catch (err) {
      setError(err);
    } finally {
      setIsPending(false);
    }
  };

  if (newCodes) {
    return (
      <TwoFactorSuccessModal
        backupCodes={newCodes}
        onClose={() => {
          setNewCodes(null);
          onClose();
        }}
      />
    );
  }

  return (
    <ControlledDialog>
      <Modal isOpen={true} onOpenChange={onClose}>
        <Dialog title="Regenerate Backup Codes" style={{ width: 440 }}>
          {({ close }) => (
            <Column gap="4">
              <Text>
                Generate a new set of 10 backup codes. Your previous backup codes will be
                immediately invalidated.
              </Text>
              <Form onSubmit={handleSubmit} error={getErrorMessage(error)}>
                <FormField label={t(labels.password)} name="password">
                  <PasswordField
                    autoComplete="current-password"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </FormField>
                <Column gap="1">
                  <Text size="sm">
                    {t(labels.twoFactorEnterCode)} (Optional if password entered)
                  </Text>
                  <OtpInput
                    value={otpValue}
                    onChange={val => {
                      setOtpValue(val);
                      if (error) setError(null);
                    }}
                    disabled={isPending}
                  />
                </Column>
                <FormButtons>
                  <Button variant="outline" onPress={close} isDisabled={isPending}>
                    {t(labels.cancel)}
                  </Button>
                  <FormSubmitButton
                    variant="danger"
                    isDisabled={isPending || (!password && otpValue.length !== 6)}
                  >
                    Regenerate Codes
                  </FormSubmitButton>
                </FormButtons>
              </Form>
            </Column>
          )}
        </Dialog>
      </Modal>
    </ControlledDialog>
  );
}
