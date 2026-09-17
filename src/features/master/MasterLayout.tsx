import { Outlet } from 'react-router-dom'
import { SubNav } from '../../components/page'
import { MASTER_SECTIONS } from '../../components/AppShell'

/** Master has exactly three sections: Products, Costing and Customers. */
export function MasterLayout() {
  return (
    <div>
      <SubNav label="Master sections" items={MASTER_SECTIONS} />
      <Outlet />
    </div>
  )
}
