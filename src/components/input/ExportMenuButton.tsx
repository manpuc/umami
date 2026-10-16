'use client';
import { Button, Icon, Menu, MenuItem, MenuTrigger, Popover, Row, Text } from '@umami/react-zen';
import { FileJson, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import { Download } from '@/components/icons';

export interface ExportMenuButtonProps {
  filename?: string;
  data?: any;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'quiet' | 'outline' | 'default';
  className?: string;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportMenuButton({
  filename = 'export-data',
  data,
  size = 'md',
  variant = 'quiet',
  className,
}: ExportMenuButtonProps) {
  const hasData = Array.isArray(data) ? data.length > 0 : Boolean(data);

  const handleExportCsv = () => {
    if (!hasData) return;
    try {
      const csv = Papa.unparse(data);
      downloadBlob(`${filename}.csv`, csv, 'text/csv;charset=utf-8;');
    } catch {
      // Fallback
    }
  };

  const handleExportJson = () => {
    if (!hasData) return;
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      downloadBlob(`${filename}.json`, jsonStr, 'application/json;charset=utf-8;');
    } catch {
      // Fallback
    }
  };

  return (
    <MenuTrigger>
      <Button
        variant={variant}
        size={size}
        className={className}
        isDisabled={!hasData}
        aria-label="Export Data"
      >
        <Icon>
          <Download />
        </Icon>
      </Button>
      <Popover side="bottom" align="end">
        <Menu>
          <MenuItem id="export-csv" onAction={handleExportCsv}>
            <Row alignItems="center" gap="2">
              <FileSpreadsheet size={16} />
              <Text>Export CSV (.csv)</Text>
            </Row>
          </MenuItem>
          <MenuItem id="export-json" onAction={handleExportJson}>
            <Row alignItems="center" gap="2">
              <FileJson size={16} />
              <Text>Export JSON (.json)</Text>
            </Row>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
