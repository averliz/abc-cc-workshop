import { formatDistanceToNowStrict, parseISO, format } from 'date-fns';

export function relative(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

export function absolute(iso: string) {
  return format(parseISO(iso), 'yyyy-MM-dd HH:mm:ss');
}
