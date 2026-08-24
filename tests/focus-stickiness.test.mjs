import assert from 'node:assert/strict';
import { selectStickyFocus } from '../pour-focus-stickiness.js';

const item=(id,priority,risk=0)=>({id,priority,recovery:{score:risk}});

let result=selectStickyFocus([item('flow-accuracy',2.1),item('pause-rhythm',2.28)],{previousFocusId:'flow-accuracy',switchMargin:.45});
assert.equal(result.selected.id,'flow-accuracy');
assert.equal(result.held,true);
assert.equal(result.reason,'stickiness-margin');

result=selectStickyFocus([item('flow-accuracy',2.1),item('pause-rhythm',2.7)],{previousFocusId:'flow-accuracy',switchMargin:.45});
assert.equal(result.selected.id,'pause-rhythm');
assert.equal(result.switched,true);
assert.equal(result.reason,'clear-priority-lead');

result=selectStickyFocus([item('flow-accuracy',2.5,20),item('pause-rhythm',2.62,84)],{previousFocusId:'flow-accuracy',switchMargin:.45,recoveryOverride:78});
assert.equal(result.selected.id,'pause-rhythm');
assert.equal(result.reason,'recovery-risk-override');

result=selectStickyFocus([item('flow-accuracy',4.5,10),item('pause-rhythm',3.1,90)],{previousFocusId:'flow-accuracy'});
assert.equal(result.selected.id,'flow-accuracy');

result=selectStickyFocus([item('pause-rhythm',2.4)],{previousFocusId:'flow-accuracy'});
assert.equal(result.selected.id,'pause-rhythm');
assert.equal(result.reason,'previous-focus-unavailable');

result=selectStickyFocus([],{previousFocusId:'flow-accuracy'});
assert.equal(result.selected,null);

console.log('focus stickiness tests: PASS');
