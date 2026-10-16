import { ExportMenuButton } from './ExportMenuButton';

export function DownloadButton({
  filename = 'data',
  data,
}: {
  filename?: string;
  data?: any;
  onClick?: () => void;
}) {
  return <ExportMenuButton filename={filename} data={data} />;
}
