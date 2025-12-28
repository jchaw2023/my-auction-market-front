import { Empty as AntEmpty } from 'antd';

interface EmptyProps {
  description?: string;
  image?: string;
}

export default function Empty({ description = 'No data', image }: EmptyProps) {
  return <AntEmpty description={description} image={image} />;
}

