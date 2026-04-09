import type { CSSProperties, DetailedHTMLProps, ImgHTMLAttributes } from 'react';

interface NextImageProps
  extends DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> {
  fill?: boolean;
  placeholder?: 'blur' | 'empty' | `data:image/${string}`;
  blurDataURL?: string;
  sizes?: string;
}

const Image = ({
  src,
  fill,
  alt = '',
  placeholder,
  blurDataURL,
  sizes,
  style: propStyle,
  ...rest
}: NextImageProps) => {
  const dataAttrs = {
    ...(placeholder ? { 'data-placeholder': placeholder } : {}),
    ...(blurDataURL ? { 'data-blur-url': blurDataURL } : {}),
  };

  if (fill) {
    const fillStyle: CSSProperties = {
      position: 'absolute',
      height: '100%',
      width: '100%',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      objectFit: 'cover',
      ...propStyle,
    };
    return (
      // biome-ignore lint/a11y/useAltText: test mock
      <img src={src} alt={alt} sizes={sizes} style={fillStyle} {...dataAttrs} {...rest} />
    );
  }
  // biome-ignore lint/a11y/useAltText: test mock
  return <img src={src} alt={alt} sizes={sizes} style={propStyle} {...dataAttrs} {...rest} />;
};

export default Image;
