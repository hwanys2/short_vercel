import HomePageClient from './HomePageClient';

export const metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
