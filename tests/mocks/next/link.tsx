import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react';

interface NextLinkProps
  extends DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

const Link = ({ href, prefetch, replace, scroll, shallow, ...rest }: NextLinkProps) => (
  <a href={href} {...rest} />
);

export default Link;
