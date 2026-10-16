import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import Spinner from '../../common/Spinner/Spinner';
import studentService from '../../../services/student/student.service';
import { getImageUrl } from '../../../utils/imageUrl';
import {
  MIN_SEARCH_LENGTH,
  buildStudentSearchParams,
  getStudentInitials,
  getStudentLabel,
  getStudentMeta,
  normalizeSearchTerm,
  shouldSearch,
} from '../../../utils/studentSearch';

const DEBOUNCE_MS = 300;

const STATUS_STYLE = {
  Active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  Graduated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
};

// Global student search for the Admin Dashboard.
//
// It reuses the existing, permission-guarded `GET /students?search=` endpoint
// (which already trims the term and matches `fullName`, `fatherName` and
// `studentId` case-insensitively) through the existing student service - no
// second endpoint, no client-side scan of the whole database. Requests are
// debounced and the suggestion list is capped, so typing never fires a request
// per keystroke and the browser never receives the whole student table.
//
// Selecting a suggestion navigates to the Single Student Management workspace
// for that exact Student ID and never guesses: the suggestion shows the name,
// Student ID and class so the user can confirm before opening it.
const StudentSearchBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/receptionist') ? '/receptionist' : '/admin';

  const listboxId = useId();
  const containerRef = useRef(null);
  const requestIdRef = useRef(0);
  const timerRef = useRef(null);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const runSearch = async (value) => {
    const term = normalizeSearchTerm(value);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');

    try {
      const response = await studentService.getAllStudents(buildStudentSearchParams(term));
      if (requestId !== requestIdRef.current) return;
      const students = response?.data?.students;
      setResults(Array.isArray(students) ? students : []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setError(err?.response?.data?.message || 'Could not search students. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setSearched(true);
      }
    }
  };

  // Debounced request, driven from the input handler (not an effect): the
  // school-wide search only fires shortly after typing pauses, and only once
  // the term is long enough to be useful. A timer ref keeps the debounce.
  const handleChange = (value) => {
    setTerm(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    const normalized = normalizeSearchTerm(value);

    if (!shouldSearch(normalized)) {
      requestIdRef.current += 1;
      setResults([]);
      setLoading(false);
      setError('');
      setSearched(false);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    setOpen(true);
    setActiveIndex(-1);
    timerRef.current = setTimeout(() => runSearch(normalized), DEBOUNCE_MS);
  };

  // Cancel any pending debounce on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Close the suggestion list on an outside click.
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const selectStudent = (student) => {
    // Never navigate without a concrete identifier: this is what prevents
    // opening the wrong student record.
    if (!student?.studentId) return;
    setOpen(false);
    setActiveIndex(-1);
    setTerm('');
    setResults([]);
    setSearched(false);
    navigate(`${base}/students/${encodeURIComponent(student.studentId)}`, {
      state: { student },
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open && shouldSearch(term)) setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      selectStudent(results[activeIndex]);
    }
  };

  const showDropdown = open && shouldSearch(term);
  const showNoResults = !loading && !error && searched && results.length === 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-label="Search students by name or Student ID"
          autoComplete="off"
          value={term}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (shouldSearch(term)) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search students by name or Student ID…"
          className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        {term ? (
          <button
            type="button"
            onClick={() => handleChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        ) : (
          loading && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Spinner size="sm" className="text-blue-500" />
            </span>
          )
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {loading && results.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
              <Spinner size="sm" className="text-blue-500" />
              Searching students…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => runSearch(term)}
                className="mt-2 inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}

          {showNoResults && (
            <div className="px-4 py-6 text-center">
              <UserGroupIcon className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                No students found
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                No match for “{normalizeSearchTerm(term)}”. Try a different name or Student ID.
              </p>
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <ul role="listbox" id={listboxId} className="max-h-96 overflow-y-auto py-1">
              {results.map((student, index) => {
                const image = student.studentImage ? getImageUrl(student.studentImage) : '';
                const active = index === activeIndex;
                return (
                  <li
                    key={student._id || student.studentId}
                    role="option"
                    id={`${listboxId}-option-${index}`}
                    aria-selected={active}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectStudent(student)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-50 dark:bg-gray-700/70'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 overflow-hidden">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(event) => {
                              event.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          getStudentInitials(student.fullName)
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {getStudentLabel(student)}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                          {getStudentMeta(student) || 'Student'}
                        </span>
                      </span>
                      {student.status && (
                        <span
                          className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${
                            STATUS_STYLE[student.status] ||
                            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {student.status}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !error && results.length === 0 && !searched && (
            <div className="px-4 py-4 text-xs text-gray-400 dark:text-gray-500">
              Type at least {MIN_SEARCH_LENGTH} characters to search.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentSearchBar;
