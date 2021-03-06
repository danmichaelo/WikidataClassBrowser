
angular.module('utilities', [])
.factory('spinner', function() {
	var opts = {
		lines: 15, // The number of lines to draw
		length: 13, // The length of each line
		width: 5, // The line thickness
		radius: 2, // The radius of the inner circle
		scale: 1.25, // Scales overall size of the spinner
		corners: 1, // Corner roundness (0..1)
		color: ['#006698', '#339966', '#900', '#339966'], //'#000', // #rgb or #rrggbb or array of colors
		opacity: 0.1, // Opacity of the lines
		rotate: 0, // The rotation offset
		direction: 1, // 1: clockwise, -1: counterclockwise
		speed: 1, // Rounds per second
		trail: 56, // Afterglow percentage
		fps: 20, // Frames per second when using setTimeout() as a fallback for CSS
		zIndex: 2e9, // The z-index (defaults to 2000000000)
		className: 'spinner', // The CSS class to assign to the spinner
		top: '50%', // Top position relative to parent
		left: '50%', // Left position relative to parent
		shadow: true, // Whether to render a shadow
		hwaccel: true, // Whether to use hardware acceleration
		position: 'absolute' // Element positioning
	}
	return function(target) {
		return new Spinner(opts).spin(target);
	};
})

.factory('i18n', function(wikidataapi, Properties, $translate) {
	var language = null; // defaults to "en" in this case

	var idTerms = {}; // cache for labels/descriptions of items
	var idTermsSize = 0; // current size of cache

	var propertyLabels = {}; // cache for labels of properties; may be unused for 'en'
	var properties = null; // properties data object (used for language en instead of fetching labels)

	var clearCache = function() {
		idTerms = {};
		idTermsSize = 0;
	}

	var getLanguage = function() {
		return language != null ? language : 'en';
	}

	// Check if an explicit lanuage was set.
	// If not, rather omit the parameter entirely.
	var fixedLanguage = function() {
		return (language != null);
	} 

	var setLanguage = function(newLang) {
		if (getLanguage() != newLang) {
			clearCache(); // clear term cache that was based on old language
			propertyLabels = {}; // clear property label cache for old language
		}
		language = newLang;
		$translate.use(getLanguage());
	}

	// Clear term cache when it grows too big to prevent memory leak.
	// This should only be called at the beginning of a new page display to ensure that
	// we don't delete cache entries that some callers require.
	var checkCacheSize = function() {
		if (idTermsSize > 5000) {
			// 5000 is a lot; only the hugest of items may reach that (which is no problem either)
			clearCache();
		}
	}

	var hasEntityTerms =  function(entityId) {
		return (entityId in idTerms);
	}

	var getEntityTerms = function(entityId) {
		if (hasEntityTerms(entityId)) {
			return idTerms[entityId];
		} else {
			return { label: entityId, description: ''};
		}
	}

	var hasPropertyLabel = function(propertyId) {
		if (getLanguage() == 'en') {
			return properties !== null;
		} else {
			return (propertyId in propertyLabels);
		}
	}

	var getPropertyLabel = function(propertyId) {
		if (hasPropertyLabel(propertyId)) { // implies (properties !== null)
			if (getLanguage() == 'en') {
				var numId = propertyId.substring(1);
				return properties.getLabelOrId(numId);
			} else {
				return propertyLabels[propertyId];
			}
		} else {
			return propertyId;
		}
	}

	var getEntityLabel = function(id) {
		if (id.substring(0,1) == 'Q') {
			return getEntityTerms(id).label;
		} else {
			return getPropertyLabel(id);
		}
	}

	var waitForTerms = function(entities) {
		var missingEntities = [];
		for (var i=0; i < entities.length; i++) {
			if (!hasEntityTerms(entities[i])) {
				missingEntities.push(entities[i]);
			}
		}
		return wikidataapi.getEntityTerms(missingEntities, getLanguage()).then(function(entityTerms) {
			angular.extend(idTerms, entityTerms);
			idTermsSize = Object.keys(idTerms).length;
			return true;
		});
	}

	var waitForPropertyLabels = function(propertyIds) {
		if (getLanguage() == 'en') {
			return Properties.then(function(props) {
				properties = props;
				return true;
			});
		} else {
			var missingPropertyIds = [];
			for (var i=0; i < propertyIds.length; i++) {
				if (!(propertyIds[i] in propertyLabels)) {
					missingPropertyIds.push(propertyIds[i]);
				}
			}
			// Make sure we always have the main properties we use in labels:
			if (!('P31' in propertyLabels)) {
				missingPropertyIds.push('P31');
			}
			if (!('P279' in propertyLabels)) {
				missingPropertyIds.push('P279');
			}
			if (!('P1647' in propertyLabels)) {
				missingPropertyIds.push('P1647');
			}

			return wikidataapi.getEntityLabels(missingPropertyIds, getLanguage()).then(function(entityLabels) {
				angular.extend(propertyLabels, entityLabels);
				return true;
			});
		}
	}

	var getEntityUrl = function(entityId) {
		return "#/view?id=" + entityId + ( fixedLanguage() ? '&lang=' + getLanguage() : '');
	}

	var autoLinkText = function(text) {
		return text.replace(/[QP][1-9][0-9]*/g, function(match) { return '<a href="' + getEntityUrl(match) +'">' + match + '</a>'; });
	}

	var getPropertyLink = function(propertyId) {
		return '<a href="' + getEntityUrl(propertyId) + '">' + getPropertyLabel(propertyId) + '</a>';
	}

	return {
		fixedLanguage: fixedLanguage,
		getLanguage: getLanguage,
		setLanguage: setLanguage,
		getEntityUrl: getEntityUrl,
		autoLinkText: autoLinkText,
		getPropertyLabel: getPropertyLabel,
		getPropertyLink: getPropertyLink,
		checkCacheSize: checkCacheSize,
		getEntityTerms: getEntityTerms,
		hasEntityTerms: hasEntityTerms,
		getEntityLabel: getEntityLabel,
		waitForTerms: waitForTerms,
		waitForPropertyLabels: waitForPropertyLabels
	};
})

.factory('htmlCache', function($sce) {
	var trustedHtmlSnippets = [];

	return {
		reset : function() { trustedHtmlSnippets = []; },
		getKey : function(html) {
			trustedHtmlSnippets.push($sce.trustAsHtml(html));
			return trustedHtmlSnippets.length-1;
		},
		getValue : function(key) {
			if (key < trustedHtmlSnippets.length) {
				return trustedHtmlSnippets[key];
			} else {
				return $sce.trustAsHtml('<span style="color: red;">HTML key ' + index + ' not found!</span>');
			}
		}
	};
})

.factory('util', function($http, $q) {

	var httpRequest = function(url) {
		return $http.get(url).then(function(response) {
			if (typeof response.data === 'object') {
				return response.data;
			} else {
				// invalid response
				return $q.reject(response.data);
			}
		},
		function(response) {
			// something went wrong
			return $q.reject(response.data);
		});
	}

	var jsonpRequest = function(url) {
		return $http.jsonp(url).then(function(response) {
			if (typeof response.data === 'object') {
				return response.data;
			} else {
				// invalid response
				return $q.reject(response.data);
			}
		},
		function(response) {
			// something went wrong
			return $q.reject(response.data);
		});
	}
	
	var getIdFromUri = function(uri) {
		if ( uri.substring(0, "http://www.wikidata.org/entity/".length) === "http://www.wikidata.org/entity/" ) {
			return uri.substring("http://www.wikidata.org/entity/".length, uri.length);
		} else {
			return null;
		}
	}

	var cloneObject = function(obj) {
	    if (obj === null || typeof obj !== 'object') {
	        return obj;
	    }
	 
	    var temp = obj.constructor(); // give temp the original obj's constructor
	    for (var key in obj) {
	        temp[key] = cloneObject(obj[key]);
	    }
	 
	    return temp;
	};

	var unionArrays = function(a1, a2){
		var unique = [];
		$.each(a1.concat(a2), function(i, el){
    		if($.inArray(el, unique) === -1){
				unique.push(el);
			}
		});
		return unique;
	};

	var sortByField = function(objectList, fieldName) {
		objectList.sort(function(a, b) {
			return a[fieldName] < b[fieldName] ? 1 : (a[fieldName] > b[fieldName] ? -1 : 0);
		});
	}

	var createIdArray = function(json){
		var ret = []
		for (var entry in json) {
			ret.push(entry);
		}
		return ret;
	}

	var getSortComparator = function(criteria, direction){
      return function(data){
        return function(a, b){
          var x = a;
          var y = b;
          var a = data[a][criteria];
          var b = data[b][criteria];
          if (a == b){          	
          	return 0;
          }
          if ((b == undefined) || (a > b)){
            return 1 * direction;
          }
          if ((a == undefined) || (a < b)){
            return (-1) * direction;
          }
          return 0;
        };
      }
    }

    var reverseDeepCopy = function(array){
    	var newarray = [];
		var j=0;
		for (var i=array.length-1; i >= 0; i--){
			newarray[j] = array[i];
			j++;
		}
		return newarray;
    }

	return {
		httpRequest: httpRequest,
		jsonpRequest: jsonpRequest,
		getIdFromUri: getIdFromUri,
		cloneObject: cloneObject,
		unionArrays: unionArrays,
		sortByField: sortByField,
		createIdArray: createIdArray,
		getSortComparator: getSortComparator,
		reverseDeepCopy: reverseDeepCopy
	};

})

.factory('sparql', function(util, i18n) {

	var SPARQL_SERVICE = "https://query.wikidata.org/bigdata/namespace/wdq/sparql";
	var SPARQL_UI_PREFIX = "https://query.wikidata.org/#";

	var getQueryUrl = function(sparqlQuery) {
		return SPARQL_SERVICE + "?query=" + encodeURIComponent(sparqlQuery);
	}

	var getQueryUiUrl = function(sparqlQuery) {
		return SPARQL_UI_PREFIX + encodeURIComponent(sparqlQuery);
	}

	var getStandardPrefixes = function() {
		return 	"PREFIX wikibase: <http://wikiba.se/ontology#> \n" +
				"PREFIX wdt: <http://www.wikidata.org/prop/direct/> \n" +
				"PREFIX wd: <http://www.wikidata.org/entity/> \n";
	};

	var getQueryRequest = function(sparqlQuery) {
		return util.httpRequest(getQueryUrl(sparqlQuery));
	};

	var getQueryForPropertySubjects = function(propertyId, objectId, limit) {
		return getStandardPrefixes() + "\
SELECT $p $pLabel \n\
WHERE { \n\
   { SELECT DISTINCT $p WHERE { $p wdt:" + propertyId +  (objectId != null ? " wd:" + objectId : " _:bnode")  +
   " . } LIMIT " + limit + " } \n\
   SERVICE wikibase:label { bd:serviceParam wikibase:language \"" + i18n.getLanguage() + "\" . } \n\
}";
	}

	var getQueryForPropertyObjects = function(subjectId, propertyId, limit) {
		return getStandardPrefixes() + "\
SELECT $p $pLabel \n\
WHERE { \n\
   { SELECT DISTINCT $p WHERE { " + (subjectId != null ? "wd:" + subjectId : "_:bnode") +
   " wdt:" + propertyId + " ?p . \n\
     FILTER(isIRI(?p)) } LIMIT " + limit + " } \n\
   SERVICE wikibase:label { bd:serviceParam wikibase:language \"" + i18n.getLanguage() + "\" . } \n\
}";
	}

	var fetchPropertySubjects = function(propertyId, objectId, limit) {
		var url = getQueryUrl(getQueryForPropertySubjects(propertyId, objectId, limit));
		return util.httpRequest(url);
	}

	var fetchPropertyObjects = function(subjectId, propertyId, limit) {
		var url = getQueryUrl(getQueryForPropertyObjects(subjectId, propertyId, limit));
		return util.httpRequest(url);
	}

	var getInlinkCount = function(propertyID, objectItemId) {
		var query = "PREFIX wdt: <http://www.wikidata.org/prop/direct/> \n\
PREFIX wd: <http://www.wikidata.org/entity/> \n\
SELECT (count(*) as $c) WHERE { $p wdt:" + propertyID + " wd:" + objectItemId + " . }";
		var result = JSON.parse(httpGet(getQueryUrl(query)));
		return result.results.bindings[0].c.value;
	}

	var parseUnarySparqlQueryResult = function(data, limit, continueUrl) {
		results = [];
		try {
			var instanceJson = data.results.bindings;
			var element;
			for (var i = 0; i < instanceJson.length; i++) {
				if ( i < limit-1 ) {
					var uri = i18n.getEntityUrl(util.getIdFromUri(instanceJson[i].p.value));
					element = {
						label: instanceJson[i].pLabel.value,
						uri: uri
					};
				} else {
					element = {
						label: '... further results', // TODO I18N
						uri: getQueryUiUrl(continueUrl)
					};
				}
				results.push(element);
			}
		}
		catch (err) {
			//nothing to do here
		}
		return results;
	}

	var getPropertySubjects = function(propertyId, objectId, limit) {
		return fetchPropertySubjects(propertyId, objectId, limit).then(function(data){
			return parseUnarySparqlQueryResult(data, limit, getQueryForPropertySubjects(propertyId, objectId, 1000));
		});
	}

	var getPropertyObjects = function(subjectId, propertyId, limit) {
		return fetchPropertyObjects(subjectId, propertyId, limit).then(function(data){
			return parseUnarySparqlQueryResult(data, limit, getQueryForPropertyObjects(subjectId, propertyId, 1000));
		});
	}

	return {
		getQueryUrl: getQueryUrl,
		getQueryUiUrl: getQueryUiUrl,
		getQueryRequest: getQueryRequest,
		getStandardPrefixes: getStandardPrefixes,
		getInlinkCount: getInlinkCount,
		getPropertySubjects: getPropertySubjects,
		getPropertyObjects: getPropertyObjects,
		getIdFromUri: util.getIdFromUri // deprecated; only for b/c
	};

})

.factory('wikidataapi', function(util, $q) {

	var getEntityData = function(id, language) {
		// Special:EntityData does not always return current data, not even with "action=purge"
		return util.jsonpRequest('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=' + id + '&redirects=yes&props=sitelinks|descriptions|claims|datatype|aliases|labels&languages=' + language + '&callback=JSON_CALLBACK');
	}

	var getEntityTerms = function(entityIds, language) {
		var baseUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&redirects=yes&props=descriptions%7Clabels&languages=' + language + '&callback=JSON_CALLBACK';
		var requests = [];

		for (var i = 0; i < entityIds.length; i += 50) {
			requests.push(util.jsonpRequest(baseUrl + '&ids=' + entityIds.slice(i,i+50).join('|')));
		}

		return $q.all(requests).then( function(responses) {
			var idTerms = {}
			angular.forEach(responses, function(response) {
				if ("entities" in response) {
					angular.forEach(response.entities, function(data,entityId) {
						var label = entityId;
						var desc = "";
						if ('labels' in data && language in data.labels) label = data.labels[language].value;
						if ('descriptions' in data && language in data.descriptions) desc = data.descriptions[language].value;
						idTerms[entityId] = { label: label, description: desc };
					});
				}
			});
			return idTerms;
		});
	};

	var getEntityLabels = function(entityIds, language) {
		var baseUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&redirects=yes&props=labels&languages=' + language + '&callback=JSON_CALLBACK';
		var requests = [];

		for (var i = 0; i < entityIds.length; i += 50) {
			requests.push(util.jsonpRequest(baseUrl + '&ids=' + entityIds.slice(i,i+50).join('|')));
		}

		return $q.all(requests).then( function(responses) {
			var entityLabels = {}
			angular.forEach(responses, function(response) {
				if ("entities" in response) {
					angular.forEach(response.entities, function(data,entityId) {
						if ('labels' in data && language in data.labels) { 
							entityLabels[entityId] = data.labels[language].value;
						} else {
							entityLabels[entityId] = entityId;
						}
					});
				}
			});
			return entityLabels;
		});
	};

	var getImageData = function(fileName, width) {
		var url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&titles=File%3A' +
			encodeURIComponent(fileName) + '&iiprop=size%7Curl&iiurlwidth=' + width + '&callback=JSON_CALLBACK';
		return util.jsonpRequest(url).then(function(response) {
			for (var key in response.query.pages) { // return first result
				return response.query.pages[key].imageinfo[0];
			}
		});
	};

	return {
		getEntityData: getEntityData,
		getEntityTerms: getEntityTerms,
		getEntityLabels: getEntityLabels,
		getImageData: getImageData
	};
})

.factory('entitydata', function(wikidataapi, util, i18n) {

	var getStatementValue = function(statementJson, defaultValue) {
		try {
			var ret = statementJson.mainsnak.datavalue.value;
			if (ret) return ret;
		} catch (err) {
			// fall through
		}
		return defaultValue;
	}

	var addEntityIdsFromSnak = function(snak, missingIds) {
		if (snak.snaktype == 'value') {
			switch (snak.datavalue.type) {
				case 'wikibase-entityid':
					if (snak.datavalue.value["entity-type"] == "item") {
						missingIds["Q" + snak.datavalue.value["numeric-id"]] = true;
					}
					break;
				case 'quantity':
					var unit = util.getIdFromUri(snak.datavalue.value.unit);
					if (unit !== null) {
						missingIds[unit] = true;
					}
					break;
				case 'globecoordinate':
					var globe = util.getIdFromUri(snak.datavalue.value.globe);
					if (globe !== null) {
						missingIds[globe] = true;
					}
					break;
				case 'time':
				case 'string':
				case 'monolingualtext':
				default:
					break; // no ids
			}
		}
	}

	var getEntityIds = function(statements) {
		var result = {};
		angular.forEach(statements, function(statementGroup) {
			angular.forEach(statementGroup, function (statement) {
				addEntityIdsFromSnak(statement.mainsnak, result);
				if ('qualifiers' in statement) {
					angular.forEach(statement.qualifiers, function (snakList) {
						angular.forEach(snakList, function(snak) {
							addEntityIdsFromSnak(snak, result);
						});
					});
				}
			});
		});
		return Object.keys(result);
	}

	var addPropertyIdsFromSnak = function(snak, missingIds) {
		if ( snak.snaktype == 'value'
			&& snak.datavalue.type == 'wikibase-entityid'
			&& snak.datavalue.value["entity-type"] == "property" ) {
				missingIds["P" + snak.datavalue.value["numeric-id"]] = true;
		}
		missingIds[snak.property] = true;
	}

	var getPropertyIds = function(statements) {
		var result = {};
		angular.forEach(statements, function(statementGroup) {
			angular.forEach(statementGroup, function (statement) {
				addPropertyIdsFromSnak(statement.mainsnak, result);
				if ('qualifiers' in statement) {
					angular.forEach(statement.qualifiers, function (snakList) {
						angular.forEach(snakList, function(snak) {
							addPropertyIdsFromSnak(snak, result);
						});
					});
				}
			});
		});
		return Object.keys(result);
	}

	var getEntityData = function(id) {
		var language = i18n.getLanguage();
		return wikidataapi.getEntityData(id, language).then(function(response) {
			var ret = {
				language: language, // this is fixed for this result!
				label: '',
				labelorid: id,
				description: '',
				images: [],
				aliases: [],
				banner: null,
				homepage: null,
				statements: {},
				missing: false,
				termsPromise: null,
				propLabelPromise: null,
				waitForPropertyLabels: function() {
					if (this.propLabelPromise == null) {
						var propIdList = getPropertyIds(this.statements);
						this.propLabelPromise = i18n.waitForPropertyLabels(propIdList, language);
					}
					return this.propLabelPromise;
				},
				waitForTerms: function() {
					if (this.termsPromise == null) {
						var termIdList = getEntityIds(this.statements);
						this.termsPromise = i18n.waitForTerms(termIdList, language);
					}
					return this.termsPromise;
				}
			};

			if ("error" in response || "missing" in response.entities[id]) {
				ret.missing = true;
				return ret;
			}

			var entityData = response.entities[id];

			if ("labels" in entityData && ret.language in entityData.labels) {
				ret.label = entityData.labels[ret.language].value;
				ret.labelorid = entityData.labels[ret.language].value;
			}
			if ("descriptions" in entityData && ret.language in entityData.descriptions) {
				ret.description = entityData.descriptions[ret.language].value;
			}
			if ("aliases" in entityData && ret.language in entityData.aliases) {
				var aliasesData = entityData.aliases[ret.language];
				for (var i in aliasesData){
					ret.aliases.push(aliasesData[i].value);
				}
			}

			if ("claims" in entityData) {
				// image
				if ("P18" in entityData.claims) {
					for (var i in entityData.claims.P18) {
						var imageFileName = getStatementValue(entityData.claims.P18[i],"");
						ret.images.push(imageFileName.replace(" ","_"));
					}
				}
				// Wikivoyage banner; only pick the first banner if multiple
				if ("P948" in entityData.claims) {
					var imageFileName = getStatementValue(entityData.claims.P948[0],null);
					ret.banner = imageFileName.replace(" ","_");
				}
				
				// homepage URL; only pick the first URL if multiple
				if ("P856" in entityData.claims) {
					ret.homepage = getStatementValue(entityData.claims.P856[0],null);
				}

				ret.statements = entityData.claims;
			}

			return ret;
		});
	};
	
	return {
		getEntityData: getEntityData
	};
})

.factory('dataFormatter', function(util, i18n) {

	var getEntityTerms = function(entityId, missingTermsListener) {
		if (!i18n.hasEntityTerms(entityId)) {
			missingTermsListener['hasMissingTerms'] = true;
		}
		return i18n.getEntityTerms(entityId);
	}

	var getSomeValueHtml = function() { return '<i><span translate="STATEMENTS.SOME_VALUE"></span></i>'; }
	var getNoValueHtml = function() { return '<i><span translate="STATEMENTS.NO_VALUE"></span></i>'; }

	/**
	 * Returns HTML to present the given value for the given property.
	 * The missingTermsListener object will have its 'hasMissingTerms' field set to
	 * true if there any labels required for the HTML are unavailable in the i18n
	 * cache. This usually means that rendering will have to wait until labels have
	 * been fetched.
	 */
	var getValueHtml = function(datavalue, numPropId, properties, missingTermsListener, inline) {
		switch (datavalue.type) {
			case 'wikibase-entityid':
				if (datavalue.value["entity-type"] == "item") {
					var itemId = "Q" + datavalue.value["numeric-id"];
					var terms = getEntityTerms(itemId, missingTermsListener);
					if (inline) {
						return '<a title="' + terms.description + '" href="' + i18n.getEntityUrl(itemId) + '">' + terms.label + '</a>';
					} else {
						return '<a href="' + i18n.getEntityUrl(itemId) + '">' + terms.label + '</a>' +
							( terms.description != '' ? ' <span class="smallnote">(' + i18n.autoLinkText(terms.description) + ')</span>' : '' );
					}
				} else if (datavalue.value["entity-type"] == "property") {
					return i18n.getPropertyLink('P' + datavalue.value["numeric-id"]);
				}
			case 'time':
				var dateParts = datavalue.value.time.split(/[-T]/);
				var precision = datavalue.value.precision;
				var epochModifier = '';
				if (dateParts[0] == '') {
					dateParts.shift();
					epochModifier = ' BCE';
				} else if (dateParts[0].substring(0,1) == '+' ) {
					dateParts[0] = dateParts[0].substring(1);
				}
				var result = dateParts[0];
				if (precision >= 10) {
					result += '-' + dateParts[1];
				}
				if (precision >= 11) {
					result += '-' + dateParts[2];
				}
				if (precision >= 12) {
					result += ' ' + dateParts[3];
				}
				return result + epochModifier;
			case 'string':
				switch (properties.getDatatype(numPropId)) {
					case 'Url':
						return '<a class="ext-link" href="' + datavalue.value + '" target="_blank">' + datavalue.value + '</a>';
					case 'CommonsMedia':
						return '<a class="ext-link" href="https://commons.wikimedia.org/wiki/File:' + datavalue.value.replace(' ','_') + '" target="_blank">' + datavalue.value + '</a>';
					//case 'String': etc.
					default:
						var urlPattern = properties.getUrlPattern(numPropId);
						if (urlPattern) {
							return '<a class="ext-link" href="' + urlPattern.replace('$1',datavalue.value) + '" target="_blank">' + datavalue.value + '</a>';
						} else {
							return datavalue.value;
						}
				}
			case 'monolingualtext':
				return i18n.autoLinkText(datavalue.value.text) + ' <span class="smallnote">[' + datavalue.value.language + ']</span>';
			case 'quantity':
				var amount = datavalue.value.amount;
				if (amount.substring(0,1) == '+') {
					amount = amount.substring(1);
				}
				var unit = util.getIdFromUri(datavalue.value.unit);
				if (unit !== null) {
					unit = ' <a href="' + i18n.getEntityUrl(unit) + '">' + getEntityTerms(unit, missingTermsListener).label + '</a>';
				} else {
					unit = '';
				}
				return amount + unit;
			case 'globecoordinate':
				var globe = util.getIdFromUri(datavalue.value.globe);
				if (globe !== null && globe != 'Q2') {
					globe = ' on <a href="' + i18n.getEntityUrl(globe) + '">' + getEntityTerms(globe, missingTermsListener).label + '</a>';
				} else {
					globe = '';
				}
				return '(' + datavalue.value.latitude + ', ' + datavalue.value.longitude + ')' + globe;
			default:
				return 'value type "' + datavalue.type + '" is not supported yet.';
		}
	}

	/**
	 * Returns the HTML to present a single snak, provided as a JSON object in the
	 * Wikibase API structure.
	 * The boolean showProperty controls if the property of the snak should be shown.
	 * The missingTermsListener object will have its 'hasMissingTerms' field set to
	 * true if there any labels required for the HTML are unavailable in the i18n
	 * cache. This usually means that rendering will have to wait until labels have
	 * been fetched.
	 */
	var getSnakHtml = function(snak, showProperty, properties, missingTermsListener, inline) {
		var ret = '';
		var propId = snak.property;
		if (showProperty) {
			ret += i18n.getPropertyLink(propId) + ' : ';
		}
		switch (snak.snaktype) {
			case 'value': 
				ret += getValueHtml(snak.datavalue, propId.substring(1), properties, missingTermsListener, inline);
				break;
			case 'somevalue':
				ret += getSomeValueHtml();
				break;
			case 'novalue':
				ret += getNoValueHtml();
				break;
		}
		return ret;
	}
	
	var getStatementMainValueHtml = function(statement, properties, missingTermsListener, inline) {
		var ret = getSnakHtml(statement.mainsnak, false, properties, missingTermsListener, inline);
		if (statement.rank == 'preferred') {
			ret += ' <span class="glyphicon glyphicon-star" aria-hidden="true" title="{{\'STATEMENTS.PREFERRED_HINT\'|translate}}"></span>';
		} else if (statement.rank == 'deprecated') {
			ret = '<span style="text-decoration: line-through;">' + ret + '</span> <span class="glyphicon glyphicon-ban-circle" aria-hidden="true" title="{{\'STATEMENTS.DEPRECATED_HINT\'|translate}}"></span>';
		}
		return ret;
	}

	var getStatementQualifiersHtml = function(statement, properties, missingTermsListener, inline) {
		var ret = '';
		angular.forEach(statement.qualifiers, function (snakList) {
			angular.forEach(snakList, function(snak) {
				ret += '<div>' + getSnakHtml(snak, true, properties, missingTermsListener, inline) + '</div>';
			});
		});
		return ret;
	}

	/**
	 * Returns the HTML to present a single statement, provided as a JSON object in the
	 * Wikibase API structure, in block format.
	 * The missingTermsListener object will have its 'hasMissingTerms' field set to
	 * true if there any labels required for the HTML are unavailable in the i18n
	 * cache. This usually means that rendering will have to wait until labels have
	 * been fetched.
	 */
	var getStatementValueBlockHtml = function(statement, properties, missingTermsListener) {
		var ret = getStatementMainValueHtml(statement, properties, missingTermsListener, false);

		if ('qualifiers' in statement) {
			ret += '<div style="padding-left: 10px; font-size: 80%; ">'
				+ getStatementQualifiersHtml(statement, properties, missingTermsListener, false)
				+ '</div>';
		}
		return ret;
	}

	/**
	 * Returns the HTML to present a single statement, provided as a JSON object in the
	 * Wikibase API structure, in inline format.
	 * The missingTermsListener object will have its 'hasMissingTerms' field set to
	 * true if there any labels required for the HTML are unavailable in the i18n
	 * cache. This usually means that rendering will have to wait until labels have
	 * been fetched.
	 * 
	 * FIXME This fails since html needs to be an angular expression that evaluates to an $sce escaped html string, which is something we cannot insert on this level.
	 */
	var getStatementValueInlineHtml = function(statement, properties, missingTermsListener) {
		var ret = getStatementMainValueHtml(statement, properties, missingTermsListener, true);

		if ('qualifiers' in statement) {
			ret += ' <span uib-popover-html="\''
				+  getStatementQualifiersHtml(statement, properties, missingTermsListener, true)//.replace(/"/g,"'")
				+ '\'"><span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span></span>';
		}

		return ret;
	}

	return {
		getValueHtml: getValueHtml,
		getSomeValueHtml: getSomeValueHtml,
		getNoValueHtml: getNoValueHtml,
		getSnakHtml: getSnakHtml,
		getStatementValueBlockHtml: getStatementValueBlockHtml,
		getStatementValueInlineHtml: getStatementValueInlineHtml,
		getStatementMainValueHtml: getStatementMainValueHtml,
		getStatementQualifiersHtml: getStatementQualifiersHtml
	};
})

.directive('sqidImage', function(wikidataapi) {

	var link = function (scope, element, attrs) {
		scope.$watch(attrs.file, function(file){
			wikidataapi.getImageData(file,attrs.width).then(function(imagedata) {
				var html = '<a href="' + imagedata.descriptionurl + '" taget="_blank">' +
						'<img src="' + imagedata.thumburl +'" style="display: block; margin-left: auto; margin-right: auto;"/>' +
					'</a>';
				element.replaceWith(html);
			});
		});
	};
	
	return {
		restrict: 'E',
		link: link
	};
})

.directive('sqidFooter', function($compile, statistics) {

	var link = function (scope, element, attrs) {
		statistics.then(function(stats) {
			var innerHtml = '<div class="col-md-6"><span translate="FOOTER.STAT_DATE" translate-value-date="' + stats.getDumpDate().toLocaleDateString() + '"></span> (<a href="#/status"><span translate="FOOTER.STAT_LINK"></span></a>)</div>';
			innerHtml += '<div class="col-md-6"><span translate="FOOTER.POWERED_BY"></span></div>';
			element.html('<hr/><div class="container-fluid"><div class="footer row">' + innerHtml + '</div></div>');
			$compile(element.contents())(scope);
		});
	};
	
	return {
		restrict: 'E',
		link: link
	};
})

/**
 * Directive to include trusted or untrusted HTML snippets and compiling
 * the result. This is necessary to expand directives within the snippets,
 * which does not work when using ng-bind-html-trusted to incude HTML.
 */
.directive('sqidCompile', ['$compile', function ($compile) {
	return function(scope, element, attrs) {
		scope.$watch(
			function(scope) {
				return scope.$eval(attrs.sqidCompile);
			},
			function(value) {
				// If value is a TrustedValueHolderType, it needs to be
				// explicitly converted to a string in order to
				// get the HTML string.
				element.html(value && value.toString());
				$compile(element.contents())(scope);
			}
		);
	};
}])

.directive('sqidStatementTable', function($compile, Properties, dataFormatter, util, i18n) {
	var properties = null;
	var missingTermsListener = { hasMissingTerms : false};

	var hideStatementsThreshold = 3; // how many statements are displayed when hiding some

	var link = function (scope, element, attrs) {
		var show = attrs.show;
		var title = attrs.title;

		missingTermsListener.hasMissingTerms = false;

		var includeProperty = function(numId) {
			if (!show || show == 'all') {
				return true;
			}
			if (numId == '31' || numId == '279') {
				return false;
			}

			var isId = (properties.getDatatype(numId) == 'ExternalId');
			var isHumanRelation = false;
			var isMedia = (properties.getDatatype(numId) == 'CommonsMedia');
			var isAboutWikiPages = (numId == '1151') || // "topic's main Wikimedia portal"
									(numId == '910'); // "topic's main category"
			angular.forEach(properties.getClasses(numId), function(classId) {
				if (classId == '19847637' || // "Wikidata property representing a unique identifier"
					classId == '18614948' || // "Wikidata property for authority control"
					classId == '19595382' || // "Wikidata property for authority control for people"
					classId == '19829908' || // "Wikidata property for authority control for places"
					classId == '19833377' || // "Wikidata property for authority control for works"
					classId == '18618628' || // "Wikidata property for authority control for cultural heritage identification"
					classId == '21745557' || // "Wikidata property for authority control for organisations"
					classId == '19833835' || // "Wikidata property for authority control for substances"
					classId == '22964274'  // "Wikidata property for identication in the film industry"
				) {
					isId = true;
				} else if (classId == '22964231') { // "Wikidata property for human relationships"
					isHumanRelation = true;
				} else if (classId == '18610173') { // "Wikidata property for Commons"
					isMedia = true;
				} else if (classId == '18667213' || // "Wikidata property about Wikimedia categories"
					classId == '22969221' // "Wikidata property giving Wikimedia list"
				) {
					isAboutWikiPages = true;
				}
			});

			switch (show) {
				case 'ids':
					return isId;
				case 'family':
					return isHumanRelation;
				case 'media':
					return isMedia;
				case 'wiki':
					return isAboutWikiPages;
				case 'other': default:
					return !isId && !isHumanRelation && !isMedia && !isAboutWikiPages;
			}
		}

		var getHtml = function(statements, propertyList) {
			missingTermsListener.hasMissingTerms = false;
			var panelId = 'statements_' + show;
			var html = '<div class="panel panel-info">\n' +
						'<div class="panel-heading" data-toggle="collapse" data-target="#' + panelId + '"><h2 class="panel-title">\n' +
						'<a style="cursor:pointer;cursor:hand">' + title + '</a></h2></div>' +
						'<div id="' + panelId + '" class="panel-collapse collapse in">' +
						'<div style="overflow: auto;"><table class="table table-striped table-condensed"><tbody>';
			var hasContent = false;
			angular.forEach(propertyList, function (propId) {
				var statementGroup = statements[propId]
				if (!missingTermsListener.hasMissingTerms) {
					var hideSomeStatements = (statementGroup.length > hideStatementsThreshold + 1);
					angular.forEach(statementGroup, function (statement, index) {
						hasContent = true;
						if (hideSomeStatements && index >= hideStatementsThreshold) {
							html += '<tr ng-if="showRows(\'' + propId + '\')">';
						} else {
							html += '<tr>';
						}
						if (index == 0) {
							html += '<th valign="top" rowspan="'
								+ (hideSomeStatements ? '{{getRowSpan(\'' + propId + '\',' + statementGroup.length + ')}}' : statementGroup.length )
								+ '" style="min-width: 20%;">'
								+ i18n.getPropertyLink(propId)
								+ (hideSomeStatements ? '<br /><div style="margin-top: 15px; "><button type="button" class="btn btn-xs" ng-click="toggleRows(\'' + propId + '\')"><span translate="{{getShowRowsMessage(\'' + propId + '\')}}" translate-value-number="' + (statementGroup.length - hideStatementsThreshold) + '"></span></button></div>' : '')
								+ '</th>';
						}
						html += '<td>' + dataFormatter.getStatementValueBlockHtml(statement, properties, missingTermsListener) + '</td>'
						html += '</tr>';
					});
				}
			});
			if (!hasContent) return '';
			html += '</tbody></table></div></div></div>';
			return html;
		}

		var preparePropertyList = function(itemData) {
			propertyScores = {};
			// Note: class-based ranking rarely seems to help; hence using properties only
			for (propertyId in itemData.statements) {
				angular.forEach(properties.getRelatedProperties(propertyId.substring(1)), function(relPropScore, relPropId) {
					if (relPropId in propertyScores) {
						propertyScores[relPropId] = propertyScores[relPropId] + relPropScore;
					} else {
						propertyScores[relPropId] = relPropScore;
					}
				});
			}

			scoredProperties = [];

			for (propertyId in itemData.statements) {
				var numPropId = propertyId.substring(1);
				if (includeProperty(numPropId)) {
					if (numPropId in propertyScores) {
						scoredProperties.push([numPropId,propertyScores[numPropId]]);
					} else {
						scoredProperties.push([numPropId,0]);
					}
				}
			}

			scoredProperties.sort(function(a, b) {
				var a = a[1];
				var b = b[1];
				return a < b ? 1 : (a > b ? -1 : 0);
			});

			ret = [];
			angular.forEach(scoredProperties, function(propertyData) {
				ret.push('P' + propertyData[0]);
			});
			return ret;
		}

		var insertAndCompile = function(html, element, scope) {
			element.html(html);
			$compile(element.contents())(scope);
		}

		// Register additional functions to toggle the display for longer lists of statements:
		scope.showRows = function(id) {
			var field = 'show' + id;
			if (field in scope) {
				return scope[field];
			} else {
				return false;
			}
		}
		scope.toggleRows = function(id) {
			var field = 'show' + id;
			scope[field] = !scope.showRows(id);
		}
		scope.getRowSpan = function(id,length) {
			return scope.showRows(id) ? length : hideStatementsThreshold;
		}
		scope.getShowRowsMessage = function(id) {
			return scope.showRows(id) ? 'STATEMENTS.LESS_STATEMENTS' : 'STATEMENTS.MORE_STATEMENTS';
		}

		scope.$watch(attrs.data, function(itemData){
			itemData.waitForPropertyLabels().then(function() {
				Properties.then(function(propertyData){
					properties = propertyData;
					var propertyList = preparePropertyList(itemData);

					var html = getHtml(itemData.statements, propertyList);
					if (missingTermsListener.hasMissingTerms) {
						itemData.waitForTerms().then( function() {
							insertAndCompile(getHtml(itemData.statements, propertyList), element, scope);
						});
					} else {
						insertAndCompile(html, element, scope);
					}
				})
			});
		});
	}

	return {
		restrict: 'E',
		link: link
	};
});

