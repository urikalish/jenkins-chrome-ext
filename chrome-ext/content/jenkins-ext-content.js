(function() {

	//let extId = 'cjmholedpdghokadoionhngnmfpeebnk';
	let buildStatusEnum = {
		PENDING: 'PENDING',
		RUNNING: 'RUNNING',
		SUCCESS: 'SUCCESS',
		WARNING: 'WARNING',
		FAILURE: 'FAILURE',
		ABORTED: 'ABORTED',
		UNKNOWN: 'UNKNOWN'
	};
	let buildResult = {
		SUCCESS:  'SUCCESS',
		FAILURE:  'FAILURE',
		UNSTABLE: 'UNSTABLE',
	};
	let buildInfos = {};
	let myName = '';
	let highlightedNames = [];
	let commitUrlPrefix = '';
	let greenCommitMessagePattern = '';
	let yellowCommitMessagePattern = '';
	let redCommitMessagePattern = '';
	let blueCommitMessagePattern = '';
	let purpleCommitMessagePattern = '';
	let buildNumberDomElms = document.querySelectorAll('.build-row-cell .pane.build-name .display-name');
	let fetchCache = {};

	async function goFetch(url, asJson = true) {
		try {
			if (fetchCache[url]) {
				return fetchCache[url];
			} else {
				const res = await fetch(url);
				const retVal = asJson ? await res.json() : await res.text();
				fetchCache[url] = retVal;
				return retVal;
			}
		} catch {
			fetchCache[url] = null;
		}
	}

	// function getInfo(url, cb, prm) {
	// 	let xhr = new XMLHttpRequest();
	// 	xhr.onreadystatechange = function() {
	// 		if (xhr.readyState === 4) {
	// 			try {
	// 				let json = JSON.parse(xhr.response);
	// 				cb(json, prm);
	// 			} catch(err) {
	// 			}
	// 		}
	// 	};
	// 	xhr.onerror = function() {
	// 		alert('err');
	// 	};
	// 	xhr.open('GET', url, true);
	//     xhr.send('');
	// }

	function formatCommiterName(commitAuthor) {
		let commiterName = commitAuthor.replace(/[,]/g, '');
		commiterName = commiterName.replace(/[._]/g, ' ');
	    commiterName = commiterName.replace(/\w\S*/g, function(txt) {
	        return txt.charAt(0).toUpperCase() + txt.substr(1);
		});
		return commiterName.trim();
	}

	function getBuildLinkElement(buildNumber) {
		let result = null;
		if (buildNumberDomElms && buildNumberDomElms.length > 0) {
			let found = false;
			buildNumberDomElms.forEach(buildLinkElm => {
				if (!found && buildLinkElm.innerText.replace(/[^\x00-\x7F]/g, '').trim() === '#' + buildNumber) {
					found = true;
					result = buildLinkElm;
				}
			});
		}
		return result;
	}

	//todo: should be generalized
	function getCommitColor(commitComment) {
		let cmt = commitComment.toLowerCase();
		let color = '#bbb';
		if (greenCommitMessagePattern && new RegExp(greenCommitMessagePattern, 'img').test(cmt)) {
			color = '#9c9';
		} else if (yellowCommitMessagePattern && new RegExp(yellowCommitMessagePattern, 'img').test(cmt)) {
			color = '#fc6';
		} else if (redCommitMessagePattern && new RegExp(redCommitMessagePattern, 'img').test(cmt)) {
			color = '#f88';
		} else if (blueCommitMessagePattern && new RegExp(blueCommitMessagePattern, 'img').test(cmt)) {
			color = '#aaf';
		} else if (purpleCommitMessagePattern && new RegExp(purpleCommitMessagePattern, 'img').test(cmt)) {
			color = '#daf';
		}
		return color;
	}

	function getNewCommiterLineElm(ci) {
		let commiterLineElm = document.createElement('div');
		commiterLineElm.className = 'jenkins-ext-build-commiter-line';

		let chatLinkElm = document.createElement('a');
		if (ci.email) {
			chatLinkElm.setAttribute('href', 'sip:' + ci.email);
			chatLinkElm.setAttribute('title', 'Chat with ' + ci.name);
		} else {
			chatLinkElm.setAttribute('title', 'No email defined for ' + ci.name);
		}
		chatLinkElm.className = 'jenkins-ext-build-commiter-chat-link';
		let chatImgElm = document.createElement('img');
		chatImgElm.setAttribute('src', chrome.extension.getURL('img/chat.png'));
		chatImgElm.className = 'jenkins-ext-build-commiter-chat-img';
		chatLinkElm.appendChild(chatImgElm);
		commiterLineElm.appendChild(chatLinkElm);

		let mailLinkElm = document.createElement('a');
		if (ci.email) {
			mailLinkElm.setAttribute('href', 'mailto:' + ci.email);
			mailLinkElm.setAttribute('title', 'Email ' + ci.name);
		} else {
			mailLinkElm.setAttribute('title', 'No email defined for ' + ci.name);
		}
		mailLinkElm.className = 'jenkins-ext-build-commiter-email-link';
		let mailImgElm = document.createElement('img');
		mailImgElm.setAttribute('src', chrome.extension.getURL('img/email.png'));
		mailImgElm.className = 'jenkins-ext-build-commiter-email-img';
		mailLinkElm.appendChild(mailImgElm);
		commiterLineElm.appendChild(mailLinkElm);

		let nameElm = document.createElement('div');
		nameElm.className = 'jenkins-ext-build-commiter-name';
		if (ci.name.toLowerCase().trim() === myName) {
			nameElm.className += ' jenkins-ext-build-commiter-name--me';
		} else if (highlightedNames.indexOf(ci.name.toLowerCase()) !== -1) {
			nameElm.className += ' jenkins-ext-build-commiter-name--highlight';
		}
		nameElm.innerHTML = ci.name;
		let tooltip = '';
		let count = 0;
		ci.commits.forEach(c => {
			count++;
			if (count > 1) {
				tooltip += `---\n`;
			}
			tooltip += c.comment;
		});
		nameElm.setAttribute('title', tooltip);
		commiterLineElm.appendChild(nameElm);

		let commitsElm = document.createElement('div');
		commitsElm.className = 'jenkins-ext-build-commiter-commits';
		ci.commits.forEach(c => {
			let commitLinkElm = document.createElement('a');
			if (commitUrlPrefix) {
				commitLinkElm.setAttribute('href', commitUrlPrefix + c.id);
			}
			commitLinkElm.setAttribute('target', '_blank');
			commitLinkElm.setAttribute('title', c.comment);
			commitLinkElm.className = 'jenkins-ext-build-commiter-commit-link';
			commitLinkElm.innerHTML = c.fileCount;
			commitLinkElm.style['background-color'] = getCommitColor(c.comment);
			commitsElm.appendChild(commitLinkElm);
		});
		commiterLineElm.appendChild(commitsElm);
		return commiterLineElm;
	}

	function getAllCommitersLineElm(commiterInfos) {
		let hrefStr;
		let commiterLineElm = document.createElement('div');
		commiterLineElm.className = 'jenkins-ext-build-commiter-line';

		let chatLinkElm = document.createElement('a');
		hrefStr = 'im:';
		commiterInfos.forEach(ci => {
			if (ci.email && ci.name.toLowerCase().trim() !== myName) {
				hrefStr += '<sip:' + ci.email + '>';
			}
		});
		chatLinkElm.setAttribute('href', hrefStr);
		chatLinkElm.setAttribute('title', 'Group Chat');
		chatLinkElm.className = 'jenkins-ext-build-commiter-chat-link';
		let chatImgElm = document.createElement('img');
		chatImgElm.setAttribute('src', chrome.extension.getURL('img/chat.png'));
		chatImgElm.className = 'jenkins-ext-build-commiter-chat-img';
		chatLinkElm.appendChild(chatImgElm);
		commiterLineElm.appendChild(chatLinkElm);

		let mailLinkElm = document.createElement('a');
		hrefStr = 'mailto:';
		commiterInfos.forEach(ci => {
			if (ci.email && ci.name.toLowerCase().trim() !== myName) {
				hrefStr += ci.email + ';';
			}
		});
		mailLinkElm.setAttribute('href', hrefStr);
		mailLinkElm.setAttribute('title', 'Group Email');
		mailLinkElm.className = 'jenkins-ext-build-commiter-email-link';
		let mailImgElm = document.createElement('img');
		mailImgElm.setAttribute('src', chrome.extension.getURL('img/email.png'));
		mailImgElm.className = 'jenkins-ext-build-commiter-email-img';
		mailLinkElm.appendChild(mailImgElm);
		commiterLineElm.appendChild(mailLinkElm);

		let nameElm = document.createElement('span');
		nameElm.className = 'jenkins-ext-build-commiter-name';
		nameElm.innerHTML = '*';
		nameElm.setAttribute('title', 'All commiters');
		commiterLineElm.appendChild(nameElm);

		return commiterLineElm;
	}

	function getNoCommitsLineElm() {
		let commiterLineElm = document.createElement('div');
		commiterLineElm.className = 'jenkins-ext-build-commiter-line';

		let noCommitsElm = document.createElement('span');
		noCommitsElm.className = 'jenkins-ext-build-commiter-no-commits';
		noCommitsElm.innerHTML = 'No commits';
		commiterLineElm.appendChild(noCommitsElm);

		return commiterLineElm;
	}

	function displayBuildCommiters(buildNumber) {
		let bi = buildInfos[buildNumber];
		let buildLinkElm = getBuildLinkElement(buildNumber);
		if (!buildLinkElm) {
			return;
		}
		let parentElm = buildLinkElm.parentElement.parentElement.parentElement;
		let commitersElm = document.createElement('div');
		commitersElm.className = 'jenkins-ext-build-commiters';
		if (bi.commiterInfos.length > 0) {
			bi.commiterInfos.forEach(ci => {
				let commiterLineElm = getNewCommiterLineElm(ci);
				commitersElm.appendChild(commiterLineElm);
			});

			if (bi.commiterInfos.length > 1) {
			 	let allCommitersLineElm = getAllCommitersLineElm(bi.commiterInfos);
			 	commitersElm.appendChild(allCommitersLineElm);
			}
			parentElm.appendChild(commitersElm);
		} else {
			let commiterLineElm = getNoCommitsLineElm();
			commitersElm.appendChild(commiterLineElm);
			parentElm.appendChild(commitersElm);
		}
	}

	function getBuildStatus(buildNumber) {
		let buildStatus = buildStatusEnum.UNKNOWN;
		let buildLinkElm = getBuildLinkElement(buildNumber);
		if (buildLinkElm) {
			let parentElm = buildLinkElm.parentElement.parentElement.parentElement;
			let statusImg = parentElm.querySelector('.build-status-link > img.icon-sm');
			if (statusImg) {
				if (statusImg.classList.contains('icon-blue')) {
					buildStatus = buildStatusEnum.SUCCESS;
				} else if (statusImg.classList.contains('icon-yellow')) {
					buildStatus = buildStatusEnum.WARNING;
				} else if (statusImg.classList.contains('icon-red')) {
					buildStatus = buildStatusEnum.FAILURE;
				} else if (statusImg.classList.contains('icon-aborted')) {
					buildStatus = buildStatusEnum.ABORTED;
				} else if (statusImg.classList.contains('icon-grey')) {
					buildStatus = buildStatusEnum.PENDING;
				} else if (statusImg.className.indexOf('-anim') !== -1) {
					buildStatus = buildStatusEnum.RUNNING;
				}
			}
		}
		return buildStatus;
	}

	function addBuildPanelClass(buildNumber) {
		let buildLinkElm = getBuildLinkElement(buildNumber);
		if (buildLinkElm) {
			let parentElm = buildLinkElm.parentElement.parentElement.parentElement;
			let buildStatus = buildInfos[buildNumber].status;
			parentElm.classList.add(`jenkins-ext-build-status--${buildStatus.toLowerCase()}`);
		}
	}

	function displayBuildProblem(buildNumber, problem) {
		let buildLinkElm = getBuildLinkElement(buildNumber);
		if (!buildLinkElm) {
			return;
		}
		let parentElm = buildLinkElm.parentElement.parentElement.parentElement;
		let problemLineElm = document.createElement('div');
		let statusStyle = '';
		if (problem.result === buildResult.FAILURE) {
			statusStyle = 'jenkins-ext-build-problem-line--failure';
		} else if (problem.result === buildResult.UNSTABLE) {
			statusStyle = 'jenkins-ext-build-problem-line--unstable';
		}
		problemLineElm.className = `jenkins-ext-build-problem-line ${statusStyle}`;

		let problemLinkElm = document.createElement('a');
		problemLinkElm.setAttribute('href', `/${problem.url}consoleFull`);
		problemLinkElm.setAttribute('target', '_blank');
		problemLinkElm.setAttribute('title', 'View console log');

		let consoleImgElm = document.createElement('img');
		consoleImgElm.setAttribute('src', chrome.extension.getURL('img/terminal.png'));
		consoleImgElm.className = 'jenkins-ext-build-problem-console-img';
		problemLinkElm.appendChild(consoleImgElm);

		problemLineElm.appendChild(problemLinkElm);

		let problemTextElm = document.createElement('div');
		problemTextElm.innerText = problem.jobName;
		problemTextElm.className = 'jenkins-ext-build-problem-text';
		problemLineElm.appendChild(problemTextElm);

		parentElm.appendChild(problemLineElm);
	}

	function addProblems(problems, buildNumber, rec) {
		if (rec.result && rec.result !== buildResult.FAILURE && rec.result !== buildResult.UNSTABLE) {
			//do nothing
		} else if (rec.build && rec.build.subBuilds && rec.build.subBuilds.length > 0) {
			addProblems(problems, buildNumber, rec.build);
		} else if (rec.subBuilds && rec.subBuilds.length > 0) {
			let problem = null;
			rec.subBuilds.forEach(sb => {
				if (!problem) {
					problem = addProblems(problems, buildNumber, sb);
				}
			});
			return problem;
		} else {
			problems.push(rec);
		}
	}

	async function getProblemLastSuccess(problem) {
		const MAX_NUM_OF_BUILDS_TO_INSPECT = 10;
		let lastSuccess = null;
		let i = 1;
		do {
			const n = problem.buildNumber - i;
			const bUrl = problem.url.replace(`/${problem.buildNumber}/`, `/${n}/`);
			const json = await goFetch(`/${bUrl}api/json`);
			if (!json) {
				i = MAX_NUM_OF_BUILDS_TO_INSPECT + 1;
			} else if (json.result === buildResult.SUCCESS) {
				lastSuccess = json;
			} else {
				i++;
			}
		} while (!lastSuccess && i <= MAX_NUM_OF_BUILDS_TO_INSPECT);
		return lastSuccess;
	}

	async function investigateProblem(problem) {
		problem.lastSuccess = await getProblemLastSuccess(problem);
		if (problem.lastSuccess) {
			//const problemText = await goFetch(`/${problem.url}consoleText`, false);
			//const successUrl = problem.url.replace(`/${problem.buildNumber}/`, `/${problem.lastSuccess.number}/`);
		 	//const successText = await goFetch(`/${successUrl}consoleText`, false);
			//console.log(problemText);
			//console.log(successText);
		}
	}

	function onGetBuildInfoDone(json, buildNumber) {
		let bi = buildInfos[buildNumber];
		bi.commiterInfos = [];
		addBuildPanelClass(buildNumber);
		let names = [];
		json.changeSet.items.forEach(commit => {
			let commiterName = formatCommiterName(commit.author.fullName);
			if (names.indexOf(commiterName) === -1) {
				names.push(commiterName);
				let email = commit.authorEmail;

				//todo: should be generalized
				if (email.indexOf('@') === -1) {
					email += '@hpe.com';
				}
				email = email.replace('@hpe.com', '@microfocus.com');

				bi.commiterInfos.push({
					name: commiterName,
					email: email,
					commits: []
				});
			}
			bi.commiterInfos[names.indexOf(commiterName)].commits.push({
				id: commit.id,
				fileCount: commit.paths.length,
				comment: commit.comment
			});
		});
		bi.commiterInfos.sort((a, b) => {
			return a.name.localeCompare(b.name);
		});
		if (json.result === buildResult.FAILURE || json.result === buildResult.UNSTABLE) {
			bi.problems = [];
			addProblems(bi.problems, buildNumber, json);
			bi.problems.forEach(p => {
				if (p.url && p.jobName) {
					displayBuildProblem(buildNumber, p);
					//investigateProblem(p).then();
				}
			});
		}
		displayBuildCommiters(buildNumber);
	}

	function onGetRootJobInfoDone(info) {
		if (info.builds) {
			info.builds.forEach(build => {
				buildInfos[build.number] = {
					number: build.number,
					url: build.url
				};
				(async () => {
					const json = await goFetch(build.url + 'api/json');
					onGetBuildInfoDone(json, build.number);
				})();
			});
			info.builds.forEach(build => {
				buildInfos[build.number].status = getBuildStatus(build.number);
			});
		}
	}

	// function updateRunningBuilds() {
	// 	for (let n in buildInfos) {
	// 		if (buildInfos[n].status === buildStatusEnum.RUNNING) {
	// 			displayBuildCommiters(buildInfos[n].number);
	// 		}
	// 	}
	// }

	// function observeDOM(obj, callback){
	// 	let obs = new MutationObserver((mutations) => {
	// 		if( mutations[0].addedNodes.length || mutations[0].removedNodes.length )
	//  	        callback();
	//  	    });
	// 	obs.observe( obj, { childList:true, subtree:true });
	// }

	chrome.runtime.onMessage.addListener(function (request /*, sender, sendResponse*/) {
		if (request.type === 'jenkins-chrome-ext-go') {
			myName = (request.myName || '').toLowerCase().trim();
			highlightedNames = (request.highlightNames || '').toLowerCase().split(',').map(Function.prototype.call, String.prototype.trim);
			commitUrlPrefix = (request.commitUrlPrefix || '').toLowerCase().trim();
			greenCommitMessagePattern = (request.greenCommitMessagePattern || '').trim();
			yellowCommitMessagePattern = (request.yellowCommitMessagePattern || '').trim();
			redCommitMessagePattern = (request.redCommitMessagePattern || '').trim();
			blueCommitMessagePattern = (request.blueCommitMessagePattern || '').trim();
			purpleCommitMessagePattern = (request.purpleCommitMessagePattern || '').trim();
			const baseLocation = document.location.href.replace(/\?\S*/, '');
			fetchCache = {};
			(async () => {
				const json = await goFetch(baseLocation + 'api/json');
				onGetRootJobInfoDone(json);
			})();

			// setTimeout(() => {
			// 	observeDOM(document.getElementById('buildHistory'), () => {
			// 		// console.log('build history was changed');
			// 		updateRunningBuilds();
			// 	});
			// }, 5000);
		}
	});

})();
