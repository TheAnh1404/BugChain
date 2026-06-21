import { useCallback, useEffect, useState } from 'react';
import { organizationService } from '../services/organizationService';

const emptyOrganization = {
  name: '',
  slug: '',
  description: '',
};

const emptyInvite = {
  email: '',
  role: 'MEMBER',
};

const emptyProject = {
  name: '',
  slug: '',
  description: '',
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function OrganizationConsole() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [organizationForm, setOrganizationForm] = useState(emptyOrganization);
  const [inviteForm, setInviteForm] = useState(emptyInvite);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const selectedOrganization = organizations.find((org) => org.id === selectedOrganizationId);

  const refreshOrganizations = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setIsLoading(true);
    }
    try {
      const result = await organizationService.list();
      setOrganizations(result);
      setSelectedOrganizationId((current) => current || result[0]?.id || '');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    async function loadOrganizations() {
      await refreshOrganizations();
    }

    loadOrganizations();
  }, [refreshOrganizations]);

  const updateOrganizationForm = (field, value) => {
    setOrganizationForm((prev) => ({
      ...prev,
      [field]: value,
      slug: field === 'name' && !prev.slug ? slugify(value) : prev.slug,
    }));
  };

  const updateProjectForm = (field, value) => {
    setProjectForm((prev) => ({
      ...prev,
      [field]: value,
      slug: field === 'name' && !prev.slug ? slugify(value) : prev.slug,
    }));
  };

  const handleCreateOrganization = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setStatus('');

    try {
      const created = await organizationService.create(organizationForm);
      setOrganizationForm(emptyOrganization);
      setSelectedOrganizationId(created.id);
      setStatus('Organization created.');
      await refreshOrganizations({ quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteMember = async (event) => {
    event.preventDefault();
    if (!selectedOrganization) return;
    setIsSaving(true);
    setError('');
    setStatus('');

    try {
      await organizationService.inviteMember(selectedOrganization.id, inviteForm);
      setInviteForm(emptyInvite);
      setStatus('Member added.');
      await refreshOrganizations({ quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    if (!selectedOrganization) return;
    setIsSaving(true);
    setError('');
    setStatus('');

    try {
      await organizationService.createProject(selectedOrganization.id, projectForm);
      setProjectForm(emptyProject);
      setStatus('Project created.');
      await refreshOrganizations({ quiet: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full px-8 py-8">
      <header className="mb-8">
        <p className="mb-2 text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]">
          Organization Support
        </p>
        <h1 className="text-4xl font-bold text-[#e8dfee]">Organizations & Projects</h1>
      </header>

      {(error || status) && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {error || status}
        </div>
      )}

      {isLoading ? (
        <div className="glass flex min-h-64 items-center justify-center rounded-2xl">
          <span className="material-symbols-outlined animate-spin text-5xl text-[#d2bbff]">
            progress_activity
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="glass rounded-2xl p-6 xl:col-span-4">
            <h2 className="mb-5 text-xl font-bold text-[#e8dfee]">Create Organization</h2>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                  Name
                </label>
                <input
                  value={organizationForm.name}
                  onChange={(event) => updateOrganizationForm('name', event.target.value)}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                  Slug
                </label>
                <input
                  value={organizationForm.slug}
                  onChange={(event) => updateOrganizationForm('slug', slugify(event.target.value))}
                  className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                  Description
                </label>
                <textarea
                  value={organizationForm.description}
                  onChange={(event) => updateOrganizationForm('description', event.target.value)}
                  className="input-dark h-28 w-full rounded-xl p-4 text-sm"
                />
              </div>
              <button
                disabled={isSaving}
                className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
                type="submit"
              >
                Create
              </button>
            </form>
          </section>

          <section className="xl:col-span-8">
            <div className="mb-5 flex flex-wrap gap-3">
              {organizations.length === 0 ? (
                <div className="glass w-full rounded-2xl p-6 text-sm text-[#ccc3d8]">
                  No organizations yet.
                </div>
              ) : (
                organizations.map((organization) => (
                  <button
                    key={organization.id}
                    onClick={() => setSelectedOrganizationId(organization.id)}
                    className={`rounded-xl border px-4 py-3 text-left ${
                      selectedOrganizationId === organization.id
                        ? 'border-[#7c3aed] bg-[#7c3aed]/20 text-[#e8dfee]'
                        : 'border-[#4a4455] bg-[#100d16] text-[#ccc3d8]'
                    }`}
                    type="button"
                  >
                    <span className="block text-sm font-bold">{organization.name}</span>
                    <span className="font-mono text-[10px]">{organization.slug}</span>
                  </button>
                ))
              )}
            </div>

            {selectedOrganization && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="glass rounded-2xl p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#e8dfee]">
                        {selectedOrganization.name}
                      </h2>
                      <p className="font-mono text-xs text-[#ccc3d8]">
                        {selectedOrganization.slug}
                      </p>
                    </div>
                    <span className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-3 py-1 font-mono text-[10px] text-[#d2bbff]">
                      {selectedOrganization.members?.length || 0} Members
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(selectedOrganization.members || []).map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#e8dfee]">
                            {member.user?.username || member.userId}
                          </p>
                          <p className="truncate text-xs text-[#ccc3d8]">
                            {member.user?.email}
                          </p>
                        </div>
                        <span className="rounded border border-[#4a4455]/50 px-2 py-1 font-mono text-[10px] text-[#d2bbff]">
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="glass rounded-2xl p-6">
                  <h2 className="mb-5 text-xl font-bold text-[#e8dfee]">Invite Member</h2>
                  <form onSubmit={handleInviteMember} className="space-y-4">
                    <input
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                      placeholder="security@example.com"
                      type="email"
                      required
                    />
                    <select
                      value={inviteForm.role}
                      onChange={(event) =>
                        setInviteForm((prev) => ({ ...prev, role: event.target.value }))
                      }
                      className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="REVIEWER">REVIEWER</option>
                      <option value="OWNER">OWNER</option>
                    </select>
                    <button
                      disabled={isSaving}
                      className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
                      type="submit"
                    >
                      Add Member
                    </button>
                  </form>
                </section>

                <section className="glass rounded-2xl p-6 lg:col-span-2">
                  <h2 className="mb-5 text-xl font-bold text-[#e8dfee]">Projects</h2>
                  <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(selectedOrganization.projects || []).map((project) => (
                      <div
                        key={project.id}
                        className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4"
                      >
                        <p className="font-bold text-[#e8dfee]">{project.name}</p>
                        <p className="mt-1 font-mono text-xs text-[#ccc3d8]">{project.slug}</p>
                        {project.description && (
                          <p className="mt-3 text-xs leading-relaxed text-[#ccc3d8]">
                            {project.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleCreateProject} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <input
                      value={projectForm.name}
                      onChange={(event) => updateProjectForm('name', event.target.value)}
                      className="input-dark rounded-xl px-4 py-3 text-sm"
                      placeholder="Wallet Core"
                      required
                    />
                    <input
                      value={projectForm.slug}
                      onChange={(event) => updateProjectForm('slug', slugify(event.target.value))}
                      className="input-dark rounded-xl px-4 py-3 text-sm"
                      placeholder="wallet-core"
                      required
                    />
                    <button
                      disabled={isSaving}
                      className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
                      type="submit"
                    >
                      Add Project
                    </button>
                    <textarea
                      value={projectForm.description}
                      onChange={(event) => updateProjectForm('description', event.target.value)}
                      className="input-dark h-24 rounded-xl p-4 text-sm md:col-span-3"
                      placeholder="Project scope or notes"
                    />
                  </form>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
