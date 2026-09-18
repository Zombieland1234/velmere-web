import copy, hashlib, tempfile, unittest
from pathlib import Path
from secret_triage import triage

class ExactReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'example.ts'; self.source.write_text('const schema = "public_schema";\n')
        self.entry = dict(path='example.ts', ruleId='generic-api-key', startLine=1, endLine=1, startColumn=1, endColumn=20,
                          fileSha256=hashlib.sha256(self.source.read_bytes()).hexdigest(), reason='Public schema name.')
        self.policy = {'scannerVersion':'8.30.1','entries':[self.entry], 'scope':'EXACT_SOURCE_ONLY','reviewType':'INTERNAL'}
        self.hit = dict(File=str(self.source), RuleID='generic-api-key',StartLine=1,EndLine=1,StartColumn=1,EndColumn=20,Secret='REDACTED')
    def run_case(self, hits=None, policy=None, code=1, version='8.30.1'):
        return triage(self.root, self.policy if policy is None else policy, [self.hit] if hits is None else hits, code, version)
    def test_exact_review_passes_without_history_claim(self):
        r=self.run_case(); self.assertTrue(r['passed']); self.assertFalse(r['historyVerified']); self.assertFalse(r['independentReview'])
    def test_unknown_hit_refuses(self):
        h=copy.deepcopy(self.hit);h['RuleID']='new-detector';self.assertFalse(self.run_case([h])['passed'])
    def test_changed_file_refuses(self):
        self.source.write_text('changed'); self.assertFalse(self.run_case()['passed'])
    def test_changed_position_refuses(self):
        h=copy.deepcopy(self.hit);h['StartColumn']=2;self.assertFalse(self.run_case([h])['passed'])
    def test_missing_hit_is_not_success(self): self.assertFalse(self.run_case([],code=0)['passed'])
    def test_duplicates_refuse(self): self.assertFalse(self.run_case([self.hit,self.hit])['passed'])
    def test_duplicate_policy_refuses(self):
        p=copy.deepcopy(self.policy);p['entries'].append(p['entries'][0]);self.assertFalse(self.run_case(policy=p)['passed'])
    def test_scanner_crash_refuses(self): self.assertFalse(self.run_case(code=2)['passed'])
    def test_wrong_version_refuses(self): self.assertFalse(self.run_case(version='0.0.0')['passed'])
    def test_nonredacted_hit_refuses(self):
        h=copy.deepcopy(self.hit);h['Secret']='synthetic not a secret';self.assertFalse(self.run_case([h])['passed'])
    def test_exit_must_match_report(self): self.assertFalse(self.run_case(code=0)['passed'])
    def test_root_escape_refuses(self):
        h=copy.deepcopy(self.hit);h['File']='../outside.ts';self.assertFalse(self.run_case([h])['passed'])
    def test_empty_report_and_empty_policy_pass_only_with_successful_scanner(self):
        p=copy.deepcopy(self.policy);p['entries']=[];self.assertTrue(self.run_case([],p,0)['passed']);self.assertFalse(self.run_case([],p,1)['passed'])
    def test_missing_review_reason_refuses(self):
        p=copy.deepcopy(self.policy);p['entries'][0]['reason']='';self.assertFalse(self.run_case(policy=p)['passed'])
    def test_nonlist_report_refuses(self): self.assertFalse(self.run_case(hits={})['passed'])

if __name__=='__main__': unittest.main(verbosity=2)
