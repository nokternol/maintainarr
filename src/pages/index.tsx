import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    // DEV BYPASS: skip login and go straight to media for Playwright analysis
    redirect: { destination: '/media', permanent: false },
  };
};

export default function Home() {
  return null;
}
