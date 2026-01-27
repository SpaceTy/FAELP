import Router from 'preact-router';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { CartPage } from '@/pages/CartPage';
import { ProfilePage } from '@/pages/ProfilePage';

export function App() {
  return (
    <Router>
      <MaterialsPage path="/" />
      <MaterialsPage path="/materials" />
      <RequestsPage path="/requests" />
      <CartPage path="/cart" />
      <ProfilePage path="/profile" />
    </Router>
  );
}
