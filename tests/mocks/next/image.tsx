import type { DetailedHTMLProps, ImgHTMLAttributes } from 'react';

const Image = (
  props: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> & {
    fill: boolean;
  }
) => {
  const { src, fill, alt = '', ...rest } = props;
  if (fill) {
    return (
      // biome-ignore lint/a11y/useAltText: <explanation>
      <img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          height: '100%',
          width: '100%',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          objectFit: 'cover',
        }}
        {...rest}
      />
    );
  }
  // biome-ignore lint/a11y/useAltText: <explanation>
  return <img src={src} alt={alt} {...rest} />;
};

export default Image;
