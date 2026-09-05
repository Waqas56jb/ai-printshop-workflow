import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CustomerModal } from '../../components/customers/CustomerModal.jsx';
import { CustomerPanel } from '../../components/customers/CustomerPanel.jsx';
import { CustomerStats } from '../../components/customers/CustomerStats.jsx';
import { CustomersTable } from '../../components/customers/CustomersTable.jsx';
import { CustomersToolbar } from '../../components/customers/CustomersToolbar.jsx';
import { JobDrawer } from '../../components/jobs/JobDrawer.jsx';
import { useCustomer, useCustomers } from '../../hooks/useCustomers.js';
import { listUsers } from '../../services/jobs.service.js';

export default function CustomersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);

  const { customers, stats, total, limit, loading, refetch } = useCustomers({
    search,
    filter,
    sort,
    page,
  });
  const { customer, refetch: refetchOne } = useCustomer(id);
  const refreshAll = useCallback(() => {
    refetch();
    refetchOne();
  }, [refetch, refetchOne]);

  useEffect(() => {
    listUsers()
      .then((rows) => setUsers((rows || []).filter((user) => user.is_active !== false)))
      .catch(() => {});
  }, []);

  const onSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  function openJob(target) {
    setPrefill(target);
    setDrawerOpen(true);
  }

  function selectedForDrawer() {
    if (prefill) return prefill;
    if (customer) return { id: customer.id, name: customer.name };
    return null;
  }

  return (
    <main className="customers-page">
      <div className="left">
        <CustomerStats stats={stats} />
        <CustomersToolbar
          search={search}
          filter={filter}
          sort={sort}
          onSearch={onSearch}
          onFilter={(value) => {
            setFilter(value);
            setPage(1);
          }}
          onSort={(value) => {
            setSort(value);
            setPage(1);
          }}
          onAdd={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        />
        <CustomersTable
          customers={customers}
          loading={loading}
          selectedId={id}
          onSelect={(row) => navigate(`/customers/${row.id}`)}
          onNewJob={openJob}
          page={page}
          total={total}
          limit={limit}
          onPage={setPage}
        />
      </div>

      <CustomerPanel
        customer={customer}
        onEdit={() => {
          setEditing(customer);
          setModalOpen(true);
        }}
        onNewJob={() => openJob(customer)}
        onDeleted={() => {
          navigate('/customers');
          refetch();
        }}
        onChanged={refreshAll}
      />

      <CustomerModal
        open={modalOpen}
        customer={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={(saved, mode) => {
          toast(mode === 'created' ? 'Customer added' : 'Customer updated');
          setModalOpen(false);
          setEditing(null);
          refetch();
          navigate(`/customers/${saved.id}`);
        }}
      />

      <JobDrawer
        open={drawerOpen}
        prefillCustomer={selectedForDrawer()}
        users={users}
        onClose={() => {
          setDrawerOpen(false);
          setPrefill(null);
        }}
        onSaved={(saved) => {
          toast(`Job ${saved.job_number} created`);
          setDrawerOpen(false);
          setPrefill(null);
          refetch();
          refetchOne();
        }}
      />
    </main>
  );
}
