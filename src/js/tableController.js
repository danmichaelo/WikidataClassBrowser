classBrowser.controller('TableController', 
  function($scope, Arguments, Classes, Properties, util){

    var tableContent = [];

    var initArray = function(idArray, data, filterfunc){
      var ret = [];
      for (var i = 0; i < idArray.length; i++){
          if (filterfunc(idArray[i], data)) {
              ret.push(idArray[i]);
          }
      }
      return ret;
    };

    var getClassFromId = function(id, data){
      var label = data.getLabel(id);
      label = label ? label + ' (Q' + id + ')': 'Q' + id;
      return ['<a href="' + data.getUrl(id) + '">' + label + '</a>',   '<div class="text-right">' + data.getDirectInstanceCount(id).toString() + '</div>', '<div class="text-right">' + data.getDirectSubclassCount(id).toString()  + '</div>'];
    };
    
    var getPropertyFromId = function(id, data){
      var label = data.getLabel(id);
      label = label ? label + ' (P' + id + ')': 'P' + id;
      return ['<a href="' + data.getUrl(id) + '">' + label + '</a>', data.getDatatype(id), '<div class="text-right">' +  data.getStatementCount(id).toString()  + '</div>', '<div class="text-right">' + data.getQualifierCount(id).toString()  + '</div>', '<div class="text-right">' + data.getReferenceCount(id).toString()  + '</div>'];
    };
    
    var refreshTableContent = function(args, idArray, content, entityConstructor){
      tableContent = [];
      for (var i = 0; i < idArray.length; i++){
        tableContent.push(entityConstructor(idArray[i], content));
      }
    };
    
    var entityFilters = {
      labelFilter: function(entry, data){
        var filter;
        var id;
        if (status.entityType == "classes"){
          filter = status.classesFilter.label.toLowerCase();
          id = "q" + entry;
        }else{
          filter = status.propertiesFilter.label.toLowerCase();
          id = 'p' + entry;
        }
        if (!filter){
          return true;
        }
        if ((filter == "") ) {
          return true;
        }
        if (id.indexOf(filter) > -1){
          return true;
        }
        var label = data.getLabel(entry);
        if (!label){
          return false;
        }
        if (label.toLowerCase().indexOf(filter) > -1){
          return true;
        }else{
          return false;
        }
      },
      datatypeFilter: function(entry, data){
        var filter;
        if (status.entityType == "classes"){
          return true;
        }else{
          filter = status.propertiesFilter.datatypes.name; 
        }
        if (!filter){
          return true;
        }
        if (filter == "Any property type"){
          return true;
        }
        if (filter == data.getDatatype(entry)){
          return true;
        }else{
          return false;
        }
      },
      suggestFilters: function(entry, data){
        var suggestFiltersHelper = function(entry, getter, value){
          if (!value){
            return true;
          }
          if (value == ""){
            return true;
          }
          var attr = getter(entry);
          if (!attr){
            return false;
          }
          if (attr.constructor === Array){
            if (attr.indexOf(value) != -1){
              return true;
            }else{
              return false;
            }
          }else{
            if (attr[value]){
              return true;
            }else{
              return false;
            }
          }
        };
        if (status.entityType == "classes"){
          return suggestFiltersHelper(entry, data.getRelatedProperties, status.classesFilter.relatedProperty)
            && suggestFiltersHelper(entry, data.getSuperClasses, status.classesFilter.superclass)
        }else{
            return suggestFiltersHelper(entry, data.getRelatedProperties, status.propertiesFilter.relatedProperty)
              && suggestFiltersHelper(entry, data.getQualifiers, status.propertiesFilter.relatedQualifier)
              && suggestFiltersHelper(entry, data.getClasses, status.propertiesFilter.directInstanceOf)
        }
      },
      sliderFilter: function(entry, data){
        if (status.entityType == "classes"){
          var filter = status.classesFilter,
            dic = data.getDirectInstanceCount(entry),
            dsc = data.getDirectSubclassCount(entry);
          if (!(((dic >= filter.instances[0])&&(dic <= filter.instances[1]))||((!dic) && (filter.instances[0] == 0)))){
            return false;
          }
          
          if (!(((dsc >= filter.subclasses[0])&&(dsc <= filter.subclasses[1]))||((!dsc) && (filter.subclasses[0] == 0)))){
            return false;
          }
          return true;
        }else{
          var filter = status.propertiesFilter;
            sc = data.getStatementCount(entry),
            qc = data.getQualifierCount(entry),
            rc = data.getReferenceCount(entry); 
          if (!(((sc >= filter.statements[0])&&(sc <= filter.statements[1]))||((!sc) && (filter.statements[0] == 0)))){
            return false;
          }
          if (!(((qc >= filter.qualifiers[0])&&(qc <= filter.qualifiers[1]))||((!qc) && (filter.qualifiers[0] == 0)))){
            return false;
          }
          if (!(((rc >= filter.references[0])&&(rc <= filter.references[1]))||((!rc) && (filter.references[0] == 0)))){
            return false;
          }
          return true;
        }
      }
    }

    var applyFilter = function(entry, data){
      for (var key in entityFilters){
        if (entityFilters.hasOwnProperty(key)) {
          if (!entityFilters[key](entry, data)){
            return false;
          }
        }
      }
      return true;
    }

    var refreshAngucompleteInputFields = function(){
      $scope.$broadcast('angucomplete-alt:changeInput', 'related-properties-classes', $scope.suggestFilters.classes.relatedProperty); // evt. für properties kopieren
      $scope.$broadcast('angucomplete-alt:changeInput', 'direct-superclass-of-class', $scope.suggestFilters.classes.superclass);
      $scope.$broadcast('angucomplete-alt:changeInput', 'related-properties-properties', $scope.suggestFilters.properties.relatedProperty);
      $scope.$broadcast('angucomplete-alt:changeInput', 'related-qualifiers', $scope.suggestFilters.properties.relatedQualifier);
      $scope.$broadcast('angucomplete-alt:changeInput', 'direct-instance-of-property', $scope.suggestFilters.properties.directInstanceOf);
    };

    var initPaginations = function(){
      if (!$scope.content){
        $scope.content = [];
      }
      $scope.pagination = {
        index: $scope.content,
        activePage: $scope.args.activePage || 1,
        onPageChange: function(){
          status.activePage = $scope.pagination.activePage;
          $scope.filterPermalink =Arguments.getUrl();
        }
      }
    };

    var initPropertyIndex = function(){
      var result = []; 
      Properties.then(function(data){
        $scope.suggestFilters.classes.relatedProperty = "";
        var idArray = data.getIdArray();
        for (var i = 0; i < idArray.length; i++){
          var elem = {
            name: data.getLabel(idArray[i]),
            idName: "P" + idArray[i],
            id: idArray[i].toString()
          }
          result.push(elem);

          if (idArray[i].toString() == status.classesFilter.relatedProperty.toString()){
            $scope.suggestFilters.classes.relatedProperty = elem;
          }
          if (idArray[i].toString() == status.propertiesFilter.relatedProperty.toString()){
            $scope.suggestFilters.properties.relatedProperty = elem;
          }
          if (idArray[i].toString() == status.propertiesFilter.relatedQualifier.toString()){
            $scope.suggestFilters.properties.relatedQualifier = elem;
          }

        }
        propertyIndexInitialized = true;
        refreshAngucompleteInputFields();
      });
      return result;
    };

    var initClassIndex = function(){
      var result = [];
      Classes.then(function(data){
        var idArray = data.getIdArray();
        for (var i = 0; i < idArray.length; i++){
          var elem = {
            name: data.getLabel(idArray[i]),
            idName: "Q" + idArray[i],
            id: idArray[i].toString()
          }
          result.push(elem);
          
          if (idArray[i].toString() == status.classesFilter.superclass.toString()){
            $scope.suggestFilters.classes.superclass = elem;
          }

        }

        classIndexInitialized = true;
        refreshAngucompleteInputFields();
      });
      return result;
    };

    var initPropertyClassIndex = function(){
      var result = [];
      Properties.then(function(propertyData){
        Classes.then(function(classData){
          var propertyClassIds = [];
          var idArray = propertyData.getIdArray();
          for (var i = 0; i < idArray.length; i++){
            propertyClassIds = util.unionArrays(propertyClassIds, propertyData.getClasses(i));
          }
          for (var i = 0; i < propertyClassIds.length; i++){
            var elem = {
              name: classData.getLabel(propertyClassIds[i]),
              idName: "Q" + propertyClassIds[i],
              id: propertyClassIds[i].toString()
            }
            result.push(elem);

            if (propertyClassIds[i].toString() == status.propertiesFilter.directInstanceOf.toString()){
              $scope.suggestFilters.properties.directInstanceOf  = elem;
            }

          }
          propertyClassIndexInitialized = true;
          refreshAngucompleteInputFields();
        });
      });
      return result;
    }

    var initClassesSlider = function(){
      $scope.slider = [ // TODO replace numbers with constants
        {name: "Number of direct instances", from: 0, 
          to: 4000000,
          startVal: status.classesFilter.instances[0], 
          endVal: status.classesFilter.instances[1]},
        {name: "number of direct subclasses", from: 0,
          to: 2000000,
          startVal: status.classesFilter.subclasses[0], 
          endVal: status.classesFilter.subclasses[1]}];
    };

    var initPropertiesSlider = function(){
      $scope.slider = [ // TODO replace numbers with constants
        {name: "Uses in statements", from: 0,
          to: 20000000,
          startVal: status.propertiesFilter.statements[0],
          endVal: status.propertiesFilter.statements[1]},
        {name: "Uses in qualifiers", from: 0,
          to: 10000000,
          startVal: status.propertiesFilter.qualifiers[0],
          endVal: status.propertiesFilter.qualifiers[1]},
        {name: "Uses in references", from: 0,
          to: 10000000,
          startVal: status.propertiesFilter.references[0],
          endVal: status.propertiesFilter.references[1]}]; 
    };

    var updateTable = function(){
      if (args.type == "classes") {
        Classes.then(function(data){
          initClassesSlider();
          var classesArray = initArray(data.getIdArray(), data, applyFilter);
          refreshTableContent(args, classesArray, data, getClassFromId);
          $scope.content = tableContent;
          $scope.tableHeader = data.classesHeader;
          $scope.pagination.setIndex($scope.content, null);
        });
      }
      if (args.type == "properties") {
          Properties.then(function(data){
            initPropertiesSlider();
            var propertiesArray = initArray(data.getIdArray(), data, applyFilter);
            refreshTableContent(args, propertiesArray, data, getPropertyFromId);
            $scope.content = tableContent;
            $scope.tableHeader = data.propertiesHeader;
            $scope.pagination.setIndex($scope.content, null);
          });
      }
    };

    var updateTableLazy = function(){
      if (!timeoutIsSet){
        timeoutIsSet = true;
        setTimeout(function(){
          timeoutIsSet = false;
          updateTable();
          }, 300);
      }
    };

    var selectElementForSuggestFilter = function(selected, statusElement, scopeElement){
      // TODO more elements for oldProperty
      var oldProperty = scopeElement.id;
      if (!selected){
        scopeElement = "";
        if (propertyIndexInitialized){
          statusElement = "";
        }
      }else{
        scopeElement = selected.originalObject;
        if (propertyIndexInitialized){
          statusElement = selected.originalObject.id;
        }
      }
      if (oldProperty != scopeElement.id){
        updateTable();
      }
      return [statusElement, scopeElement];
    };

    // execution part
    Arguments.refreshArgs();
    var args = Arguments.getArgs();
    var status = Arguments.getStatus();
    
    var propertyIndexInitialized = false;
    var classIndexInitialized = false;
    var propertyClassIndexInitialized = false;
    
    var timeoutIsSet = false;

    $scope.suggestFilters = {
      data: {
        propertyIndex: initPropertyIndex(),
        classIndex: initClassIndex(),
        propertyClassIndex: initPropertyClassIndex()
      },
      classes: {
        relatedProperty: "",
        superclass: ""
      },
      properties: {
        relatedProperty: "",
        relatedQualifier: "",
        directInstanceOf: ""
      }
    };

    $scope.tableSize = 15;
    $scope.args=args;
    if (status.entityType == "classes"){
      $scope.filterLabels = status.classesFilter.label;
    }else{
      $scope.filterLabels = status.propertiesFilter.label;
    }
    initPaginations();

    $scope.datatypeSelector = {
      options: [{id: 1, name: "Any property type"},
      {id: 2, name: "WikibaseItem"},
      {id: 3, name: "WikibaseProperty"},
      {id: 4, name: "String"},
      {id: 5, name: "Url"},
      {id: 6, name: "CommonsMedia"},
      {id: 7, name: "ExternalId"},
      {id: 8, name: "Time"},
      {id: 9, name: "GlobeCoordinate"},
      {id: 10, name: "Quantity"},
      {id: 11, name: "Monolingualtext"}],
      selected: status.propertiesFilter.datatypes
    }

    $scope.filterPermalink =Arguments.getUrl();
    if (!$scope.filterText) {$scope.filterText = ""};
    
    updateTable();

    $scope.searchFilter = function(){
      if (status.entityType == "classes"){
        status.classesFilter.label = $scope.filterLabels;
      }else{
        status.propertiesFilter.label = $scope.filterLabels;
      }
      updateTableLazy();
    }

    $scope.setDatatypeFilter = function(data){
      status.propertiesFilter.datatypes = data;
      $scope.filterPermalink =Arguments.getUrl();
      updateTable();
    }

    $scope.resetFilters = function(){
      status.classesFilter = Arguments.getStatusStartValues().classesFilter;
      status.propertiesFilter = Arguments.getStatusStartValues().propertiesFilter;
      $scope.suggestFilters.classes.relatedProperty = "";
      $scope.$broadcast('angucomplete-alt:changeInput', 'related-properties', $scope.suggestFilters.classes.relatedProperty);
      updateTable();
    }

    $scope.updateStatus = function(){
      if (status.entityType == "classes"){
        status.classesFilter.instances[0] = $scope.slider[0].startVal;
        status.classesFilter.instances[1] = $scope.slider[0].endVal;
        status.classesFilter.subclasses[0] = $scope.slider[1].startVal;
        status.classesFilter.subclasses[1] = $scope.slider[1].endVal;
      }else{
        status.propertiesFilter.statements[0] = $scope.slider[0].startVal;
        status.propertiesFilter.statements[1] = $scope.slider[0].endVal;
        status.propertiesFilter.qualifiers[0] = $scope.slider[1].startVal;
        status.propertiesFilter.qualifiers[1] = $scope.slider[1].endVal;
        status.propertiesFilter.references[0] = $scope.slider[2].startVal;
        status.propertiesFilter.references[1] = $scope.slider[2].endVal;
      }
      $scope.filterPermalink =Arguments.getUrl();
      updateTableLazy();
    }
    
    $scope.copyToClipboard = function(){
      var textField = document.getElementById("permalink");
      var oSelectionStart = textField.SelectionStart;
      var oSelectionEnd = textField.SelectionEnd;
      var currentFocus = document.activeElement;
      textField.focus();
      textField.setSelectionRange(0, textField.value.length);
      document.execCommand("copy");
      if (currentFocus && typeof currentFocus.focus === "function") {
        currentFocus.focus();
      }
      textField.setSelectionRange(oSelectionStart, oSelectionEnd);
    }

    $scope.sortElement = function(element, header){
      var direction = 0;
      switch(element[2]){
        case "fa fa-sort":
          element[2] = "fa fa-sort-desc";
          direction = (-1);
          break;
        case "fa fa-sort-desc":
          element[2] = "fa fa-sort-asc";
          direction = 1;
          break;
        case "fa fa-sort-asc":
          element[2] = "fa fa-sort-desc";
          direction = (-1);
          break;
        default:
          console.log("Unknown sort style " + element[2]);
      }
      for (var i=0; i < header.length; i++){
        if (header[i] != element){
          header[i][2] = "fa fa-sort";
          header[i][3](status, header[i][2]);
        }
      }
      element[3](status, element[2]);
      if (status.entityType == "classes"){
        Classes.then(function(data){
          data.sortClasses();
          updateTable();
        });
      }else{
        Properties.then(function(data){
          data.sortProperties();
          updateTable();
        });
      }
    }

    $scope.suggestSelectFunctions = {
      classes:{
        relatedProperty : function(selected){
          var result = selectElementForSuggestFilter(selected, 
          status.classesFilter.relatedProperty, $scope.suggestFilters.classes.relatedProperty);
          status.classesFilter.relatedProperty = result[0];
          $scope.suggestFilters.classes.relatedProperty = result[1];
        },
        superclass : function(selected){
          var result = selectElementForSuggestFilter(selected, 
          status.classesFilter.superclass, $scope.suggestFilters.classes.superclass);
          status.classesFilter.superclass = result[0];
          $scope.suggestFilters.classes.superclass = result[1];
        },
      },
      properties: {
        relatedProperty : function(selected){
          var result = selectElementForSuggestFilter(selected, 
          status.propertiesFilter.relatedProperty, $scope.suggestFilters.properties.relatedProperty);
          status.propertiesFilter.relatedProperty = result[0];
          $scope.suggestFilters.properties.relatedProperty = result[1];
        },
        relatedQualifier : function(selected){
          var result = selectElementForSuggestFilter(selected, 
          status.propertiesFilter.relatedQualifier, $scope.suggestFilters.properties.relatedQualifier);
          status.propertiesFilter.relatedQualifier = result[0];
          $scope.suggestFilters.properties.relatedQualifier = result[1];
        },
        directInstanceOf : function(selected){
          var result = selectElementForSuggestFilter(selected, 
          status.propertiesFilter.directInstanceOf, $scope.suggestFilters.properties.directInstanceOf);
          status.propertiesFilter.directInstanceOf = result[0];
          $scope.suggestFilters.properties.directInstanceOf = result[1];
        },
        
      }
    };

    var localSearch = function(str, data){
      var matches = [];
      var exactMatches = [];
      var str = str.toLowerCase();
      for (var i=0; i < data.length; i++){
        var elem = data[i];
        if (elem.idName != null){
          if (elem.idName.toLowerCase() == str){
            exactMatches.push(elem);
            continue;
          }
        }
        if (elem.name != null){
          if (elem.name.toLowerCase() == str){
            exactMatches.push(elem);
            continue;
          }
        }
        if (elem.idName != null){
          if (elem.idName.toLowerCase().indexOf(str) != -1){
            matches.push(elem);
            continue;
          }
        }
        if (elem.name != null){
          if (elem.name.toLowerCase().indexOf(str) != -1){
            matches.push(elem);
            continue;
          }
        }
      }
      matches.sort(function(a, b){
        if (a.name > b.name){
          return 1;
        }
        if (a.name < b.name){
          return -1;
        }
        return 0;
      });
      matches.length = Math.min(matches.length, 10 - exactMatches.length)
      return exactMatches.concat(matches);
    };

    $scope.localSearchProperties = function(str){
      return localSearch(str, $scope.suggestFilters.data.propertyIndex);
    };

    $scope.localSearchClasses = function(str){
      return localSearch(str, $scope.suggestFilters.data.classIndex);
    };

    $scope.localSearchPropertyClasses = function(str){
      return localSearch(str, $scope.suggestFilters.data.propertyClassIndex);
    };


  });
