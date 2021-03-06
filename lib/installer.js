const initial = require('../' + process.argv[3])
const _ = require('lodash')
const utils = require('../utils/utils')
const DependencyGraph = require('./dependencyGraph')
const Dependency = require('./dependency')
const Installer = module.exports = {}
Installer.execute = (stateObject) => {
  Installer.setup(stateObject)
  Installer.buildDependencyTree(stateObject)
  Installer.buildInstallCommands(stateObject)
  return stateObject
}

Installer.setup = (stateObject) => {
  stateObject.dependencyGraph = new DependencyGraph(stateObject.constraints)
  stateObject.repository.solvePackagesOptionalDependencies(stateObject.dependencyGraph.constraints)
  stateObject.commands = []
  return stateObject
}

Installer.buildDependencyTree = (stateObject) => {
  stateObject.resolvedPackages = []
  _.forEach(stateObject.dependencyGraph.constraints, constraint => {
    const packages = stateObject.repository.packages[constraint.name]
    if (constraint.version === '') {
      const selectedPackage = utils.filterDependencies(packages)
      selectedPackage.resolvePackageDependencies(stateObject.repository.packages, stateObject.dependencyGraph.constraints)
      selectedPackage.constraintData = constraint
      stateObject.resolvedPackages.push(selectedPackage)
    } else {
      const selectedPackage = utils.filterDependenciesOnVersion(constraint, stateObject.repository.packages[constraint.name])
      selectedPackage.resolvePackageDependencies(stateObject.repository.packages, stateObject.dependencyGraph.constraints)
      selectedPackage.constraintData = constraint
      stateObject.resolvedPackages.push(selectedPackage)
    }
  })
  return stateObject
}

Installer.buildInstallCommands = (stateObject) => {
  const reducedCommands = _.reduce(stateObject.resolvedPackages, (commands, packageToInstall) => {
    // console.log(packageToInstall)
    _.forEach(packageToInstall.allConflicts, conflict => {
      const conflictPackage = utils.filterDependenciesOnVersion(conflict, stateObject.repository.packages[conflict.name])
      const conflictString = `${conflictPackage.name}=${conflictPackage.version}`
      if(initial.indexOf(conflictString) !== -1) {
        commands.push(`-${conflictString}`)
      }
    })
    _.forEachRight(packageToInstall.allDeps, dep => {
      let depString
      if (dep instanceof Dependency) {
        if (dep.version === '') {
          dep = utils.filterDependencies(stateObject.repository.packages[dep.name])
        } else {
          dep = utils.filterDependenciesOnVersion(dep, stateObject.repository.packages[dep.name])
        }
        depString = `${dep.name}=${dep.version}`
      } else {
        depString = dep
      }
      if (commands.indexOf('+'+depString) === -1 && commands.indexOf('-'+depString) === -1) {
        if (packageToInstall.constraintData.install && initial.indexOf(depString) === -1) {
          // console.log(`adding 1+${depString}`)
          commands.push(`+${depString}`)
        } else {
          commands.push(`-${depString}`)
        }
      }
    })
    const depString = `${packageToInstall.name}=${packageToInstall.version}`
    if (commands.indexOf('+'+depString) === -1 && commands.indexOf('-'+depString) === -1) {
      if (packageToInstall.constraintData.install && initial.indexOf(depString) === -1) { 
        // console.log(`adding 2+${depString}`)
        commands.push(`+${depString}`)
      } else {
        commands.push(`-${depString}`)
      }
    }
    return commands
  }, [])
  stateObject.commands = stateObject.commands.concat(reducedCommands)
  return stateObject
}
