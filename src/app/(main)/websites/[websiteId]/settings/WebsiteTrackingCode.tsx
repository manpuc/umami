'use client';
import { Column, Label, Row, Switch, Text, TextField } from '@umami/react-zen';
import { useState } from 'react';
import { useConfig, useMessages } from '@/components/hooks';

const SCRIPT_NAME = 'script.js';

export function WebsiteTrackingCode({
  websiteId,
  hostUrl,
  showHeader = true,
}: {
  websiteId: string;
  hostUrl?: string;
  showHeader?: boolean;
}) {
  const { t, messages, labels } = useMessages();
  const config = useConfig();
  const [includePerformance, setIncludePerformance] = useState(false);

  const trackerScriptName =
    config?.trackerScriptName?.split(',')?.map((n: string) => n.trim())?.[0] || SCRIPT_NAME;

  const getUrl = (scriptName: string) => {
    if (config?.cloudMode) {
      return `${process.env.cloudUrl}/${scriptName}`;
    }

    return `${hostUrl || window?.location?.origin || ''}${
      process.env.basePath || ''
    }/${scriptName}`;
  };

  const url = trackerScriptName?.startsWith('http') ? trackerScriptName : getUrl(trackerScriptName);

  const code = `<script defer src="${url}" data-website-id="${websiteId}"${
    includePerformance ? ' data-performance="true"' : ''
  }></script>`;

  return (
    <Column gap>
      {showHeader && <Label>{t(labels.trackingCode)}</Label>}
      <Text color="muted">{t(messages.trackingCode)}</Text>
      <TextField
        value={code}
        isReadOnly
        allowCopy
        asTextArea
        resize="none"
        className="code-textarea"
      />
      <Row alignItems="center" gap="3">
        <Switch isSelected={includePerformance} onChange={setIncludePerformance} />
        <Column gap="0">
          <Text weight="bold">Collect Core Web Vitals</Text>
          <Text size="sm" color="muted">
            Adds data-performance="true" to measure LCP, INP, CLS, FCP, and TTFB in your Performance
            reports.
          </Text>
        </Column>
      </Row>
    </Column>
  );
}
